const pool = require('../config/db');
const { normalizeCurrency } = require('../utils/currencyUtils');
const { applyExperienceToPlayer } = require('../shared/player_progression');
const achievementService = require('../services/achievementService');
const statisticsService = require('../services/statisticsService');

// --- HELPER: Generar Stats Fijos (Resuelve bug de rangos) ---
const generateQuestItemStats = (templateStats) => {
    const finalStats = {};
    if (!templateStats) return {};

    for (const [key, value] of Object.entries(templateStats)) {
        // Si es un rango [min, max], elige un número al azar
        if (Array.isArray(value) && value.length === 2) {
            finalStats[key] = Math.floor(Math.random() * (value[1] - value[0] + 1)) + value[0];
        } else {
            // Si es fijo, lo mantiene
            finalStats[key] = value;
        }
    }
    return finalStats;
};

// Configuración
const getMaxQuestSlots = (level) => {
    if (level >= 40) return 5;
    if (level >= 21) return 4;
    if (level >= 11) return 3;
    return 2; 
};

// 1. OBTENER ESTADO (Auto-asigna semanales y gestiona tabs)
exports.getQuestStatus = async (req, res) => {
    const userId = req.user.id;
    const { context } = req.query; 

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Obtener datos jugador
        const playerRes = await client.query('SELECT level, last_hall_action_at, evolution_quest_status FROM players WHERE id = $1', [userId]);
        if (playerRes.rows.length === 0) return res.status(404).json({ message: "Jugador no encontrado" });
        const player = playerRes.rows[0];

        // --- CONTEXTO: EVOLUCIÓN ---
        if (context === 'evolution') {
            // Obtener datos completos del jugador (incluye tier actual)
            const playerFullRes = await client.query(`
                SELECT p.level, p.race, p.class_id, p.evolution_quest_status,
                       c.tier as current_tier
                FROM players p
                LEFT JOIN classes c ON p.class_id = c.id
                WHERE p.id = $1
            `, [userId]);
            const pf = playerFullRes.rows[0];
            if (!pf) {
                await client.query('COMMIT');
                return res.status(404).json({ message: "Jugador no encontrado" });
            }
            const currentTier = pf.current_tier || 0;

            // Buscar quest evolution activa
            const evoQuestRes = await client.query(`
                SELECT pq.*, q.title, q.description, q.requirements, q.min_level as quest_min_level,
                       p.pending_class_id, p.class_id as player_class_id
                FROM player_quests pq
                JOIN quests q ON pq.quest_id = q.id
                JOIN players p ON pq.player_id = p.id
                WHERE pq.player_id = $1 AND q.type = 'evolution' AND pq.status = 'active'
            `, [userId]);

            if (evoQuestRes.rows.length > 0) {
                const row = evoQuestRes.rows[0];

                // --- VALIDAR: la quest activa sigue siendo válida para el tier actual ---
                const validNextRes = await client.query(`
                    SELECT id FROM classes
                    WHERE parent_id = $1 AND min_level <= $2
                      AND (race_restriction IS NULL OR race_restriction = $3)
                `, [row.player_class_id || 0, pf.level, pf.race]);
                const validIds = validNextRes.rows.map(r => r.id);

                const isStale = row.pending_class_id && validIds.length > 0
                    && !validIds.includes(row.pending_class_id);

                if (isStale) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`[Evolution] Stale quest detected for player ${userId}: pending_class_id ${row.pending_class_id} not in [${validIds.join(',')}]. Auto-cancelling.`);
                    }
                    await client.query("UPDATE player_quests SET status = 'cancelled' WHERE id = $1", [row.id]);
                    await client.query("UPDATE players SET pending_class_id = NULL, evolution_quest_status = 'completed' WHERE id = $1", [userId]);
                    await client.query('COMMIT');
                    // Fall through to check next evolution
                } else {
                    // Quest válida — devolver progreso
                    const pendingClassId = row.pending_class_id;
                    let classInfo = null;
                    if (pendingClassId) {
                        const cRes = await client.query("SELECT name, image_url FROM classes WHERE id = $1", [pendingClassId]);
                        if (cRes.rows.length > 0) classInfo = cRes.rows[0];
                    }
                    const progressData = row.progress || {};
                    const reqs = row.requirements || [];
                    const progressSummary = reqs.map(r => ({
                        current: Number(progressData[r.target_id || r.type]) || 0,
                        required: Number(r.count) || 0,
                        type: r.type,
                        label: r.name || null
                    }));
                    await client.query('COMMIT');
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`[Evolution] Active quest for player ${userId}: pending=${pendingClassId}, progress=${JSON.stringify(progressData)}`);
                    }
                    return res.json({ status: 'in_progress', quest: row, targetClass: classInfo, progressSummary });
                }
            } else {
                await client.query('COMMIT');
            }

            // Verificar siguiente evolución disponible
            const hasEvolutionReady = await pool.query(
                `SELECT 1 FROM classes
                 WHERE parent_id = (SELECT class_id FROM players WHERE id = $1)
                   AND min_level <= $2
                   AND (race_restriction IS NULL OR race_restriction = (SELECT race FROM players WHERE id = $1))
                 LIMIT 1`,
                [userId, pf.level]
            );

            const isCompleted = pf.evolution_quest_status === 'completed';
            if (hasEvolutionReady.rows.length > 0) {
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`[Evolution] Next tier available for player ${userId} (level ${pf.level}, status=${pf.evolution_quest_status})`);
                }
                return res.json({ status: 'available' });
            }
            const finalStatus = isCompleted ? 'completed' : 'locked';
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[Evolution] No next tier for player ${userId}: returning '${finalStatus}'`);
            }
            return res.json({ status: finalStatus });
        }

        // --- CONTEXTO: SALÓN DE VALHALLUS ---
        if (context === 'hall') {
            
            // 1. LOGICA SEMANAL (AUTO-ASIGNAR)
            const weeklyCheck = await client.query(`
                SELECT pq.id FROM player_quests pq 
                JOIN quests q ON pq.quest_id = q.id 
                WHERE pq.player_id = $1 AND q.type = 'weekly' AND pq.status = 'active'
            `, [userId]);

            if (weeklyCheck.rows.length === 0) {
                const newWeeklies = await client.query(`
                    SELECT id FROM quests 
                    WHERE type = 'weekly' AND min_level <= $1 
                    ORDER BY RANDOM() LIMIT 3
                `, [player.level]);

                for (const q of newWeeklies.rows) {
                    await client.query("INSERT INTO player_quests (player_id, quest_id, status, progress) VALUES ($1, $2, 'active', '{}')", [userId, q.id]);
                }
            }

            // 2. RECUPERAR TODAS LAS ACTIVAS
            const allActiveRes = await client.query(`
                SELECT pq.*, q.title, q.description, q.requirements, q.type, q.min_level, q.reward_xp, q.reward_gold, q.reward_silver, q.reward_copper
                FROM player_quests pq
                JOIN quests q ON pq.quest_id = q.id
                WHERE pq.player_id = $1 AND pq.status = 'active' AND q.type != 'evolution'
            `, [userId]);

            const dailyActive = allActiveRes.rows.filter(q => q.type === 'daily');
            const weeklyActive = allActiveRes.rows.filter(q => q.type === 'weekly');

            // 3. RECUPERAR TABLÓN DISPONIBLE
            const dailyAvailable = await client.query(`
                SELECT * FROM quests 
                WHERE type = 'daily' 
                AND min_level <= $1
                AND id NOT IN (SELECT quest_id FROM player_quests WHERE player_id = $2 AND status = 'active')
                ORDER BY min_level DESC, RANDOM() 
                LIMIT 6
            `, [player.level, userId]);

            // 4. CALCULAR COOLDOWN
            let globalCooldown = 0;
            if (player.last_hall_action_at) {
                const diff = (new Date() - new Date(player.last_hall_action_at)) / 1000;
                if (diff < 300) globalCooldown = Math.ceil(300 - diff);
            }

            await client.query('COMMIT');

            return res.json({
                dailyActive,
                dailyAvailable: dailyAvailable.rows,
                weeklyActive,
                maxSlots: getMaxQuestSlots(player.level),
                globalCooldown
            });
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: "Error interno." });
    } finally {
        client.release();
    }
};

// 2. ACEPTAR MISIÓN
exports.acceptQuest = async (req, res) => {
    const userId = req.user.id;
    const { questId } = req.body; 

    try {
        const playerRes = await pool.query('SELECT level, last_hall_action_at FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        if (player.last_hall_action_at) {
            const diff = (new Date() - new Date(player.last_hall_action_at)) / 1000;
            if (diff < 300) return res.status(400).json({ message: `Debes esperar ${Math.ceil(300 - diff)}s para realizar otra acción.` });
        }

        const maxSlots = getMaxQuestSlots(player.level);
        const countRes = await pool.query(`
            SELECT COUNT(*) FROM player_quests pq JOIN quests q ON pq.quest_id = q.id 
            WHERE pq.player_id = $1 AND pq.status = 'active' AND q.type = 'daily'
        `, [userId]);
        
        if (parseInt(countRes.rows[0].count) >= maxSlots) {
            return res.status(400).json({ message: `Límite de misiones diarias alcanzado (${maxSlots}).` });
        }

        await pool.query("INSERT INTO player_quests (player_id, quest_id, status, progress) VALUES ($1, $2, 'active', '{}')", [userId, questId]);
        await pool.query("UPDATE players SET last_hall_action_at = NOW() WHERE id = $1", [userId]);

        res.json({ success: true, message: "Contrato firmado. (Cooldown activado)" });

    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: "Misión ya activa." });
        res.status(500).json({ message: "Error al aceptar." });
    }
};

// 3. REFRESCAR TABLÓN
exports.refreshBoard = async (req, res) => {
    const userId = req.user.id;
    
    try {
        const playerRes = await pool.query('SELECT last_hall_action_at FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        if (player.last_hall_action_at) {
            const diff = (new Date() - new Date(player.last_hall_action_at)) / 1000;
            if (diff < 300) return res.status(400).json({ message: `Debes esperar ${Math.ceil(300 - diff)}s.` });
        }

        await pool.query("UPDATE players SET last_hall_action_at = NOW() WHERE id = $1", [userId]);

        res.json({ success: true, message: "Tablón actualizado. (Cooldown activado)" });
    } catch (err) {
        res.status(500).json({ message: "Error al refrescar." });
    }
};

// 5. CANCELAR MISIÓN
exports.cancelQuest = async (req, res) => {
    const userId = req.user.id;
    const { playerQuestId } = req.body;

    if (!playerQuestId) {
        return res.status(400).json({ message: "playerQuestId es requerido." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pqRes = await client.query(`
            SELECT pq.id, pq.status, q.type
            FROM player_quests pq
            JOIN quests q ON pq.quest_id = q.id
            WHERE pq.id = $1 AND pq.player_id = $2
        `, [playerQuestId, userId]);

        if (pqRes.rows.length === 0) {
            await client.query('COMMIT');
            return res.status(404).json({ message: "Misión no encontrada." });
        }

        const quest = pqRes.rows[0];

        if (quest.status !== 'active') {
            await client.query('COMMIT');
            return res.status(400).json({ message: "Solo puedes cancelar misiones activas." });
        }

        const cancelableTypes = ['daily', 'side', 'zone'];
        if (!cancelableTypes.includes(quest.type)) {
            await client.query('COMMIT');
            return res.status(400).json({ message: "Este tipo de misión no se puede cancelar." });
        }

        await client.query(
            "UPDATE player_quests SET status = 'cancelled', completed_at = NULL WHERE id = $1",
            [playerQuestId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Misión cancelada." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: "Error al cancelar misión." });
    } finally {
        client.release();
    }
};

// 4. COMPLETAR (Reclamar Recompensa)
exports.completeQuest = async (req, res) => {
    const userId = req.user.id;
    const { playerQuestId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pqRes = await client.query(`
            SELECT pq.*, q.requirements, q.reward_xp, q.reward_gold, q.reward_silver, q.reward_copper, q.reward_onix, q.reward_items, q.type
            FROM player_quests pq
            JOIN quests q ON pq.quest_id = q.id
            WHERE pq.id = $1 AND pq.player_id = $2 AND pq.status = 'active'
        `, [playerQuestId, userId]);

        if (pqRes.rows.length === 0) throw new Error("Misión no válida o ya reclamada.");
        const userQuest = pqRes.rows[0];
        
        // Validar progreso
        let isComplete = true;
        const progress = userQuest.progress || {};
        (userQuest.requirements || []).forEach(req => {
            const current = progress[req.target_id || req.type] || 0;
            if (current < req.count) isComplete = false;
        });

        if (!isComplete) throw new Error("Objetivos incompletos.");

        // Datos jugador
        const playerData = (await client.query("SELECT gold, silver, copper, onix FROM players WHERE id = $1", [userId])).rows[0];
        const finalOnix = parseInt(playerData.onix || 0) + parseInt(userQuest.reward_onix || 0);

        // Economía
        const rewardTotal = ((userQuest.reward_gold || 0) * 10000) + ((userQuest.reward_silver || 0) * 100) + (userQuest.reward_copper || 0);
        const normalized = normalizeCurrency(playerData.gold || 0, playerData.silver || 0, playerData.copper || 0, rewardTotal);

        // XP y Nivel (usando helper compartido con level-up loop)
        await applyExperienceToPlayer(client, userId, userQuest.reward_xp || 0);

        // Guardar cambios en Jugador (monedas y onix; EXP/level/stat_points ya los actualizó applyExperienceToPlayer)
        await client.query(
            `UPDATE players 
             SET gold = $1, silver = $2, copper = $3, onix = $4
             WHERE id = $5`,
            [normalized.newGold, normalized.newSilver, normalized.newCopper, finalOnix, userId]
        );
        
        // --- GUARDAR ITEMS (CORREGIDO CON GENERACIÓN DE STATS) ---
        if (userQuest.reward_items) {
            for (const item of userQuest.reward_items) {
                // 1. Obtener la plantilla para saber sus stats base
                const tplRes = await client.query('SELECT type, base_stats FROM items_templates WHERE id = $1', [item.template_id]);
                
                if (tplRes.rows.length > 0) {
                    const template = tplRes.rows[0];
                    let finalStats = {};

                    // 2. Generar stats únicos si es equipo
                    if (template.type !== 'material' && template.type !== 'consumable') {
                         finalStats = generateQuestItemStats(template.base_stats);
                    }

                    // 3. Insertar con datos resueltos
                    await client.query(
                        `INSERT INTO player_packages (player_id, item_template_id, quantity, data) VALUES ($1, $2, $3, $4)`, 
                        [userId, item.template_id, item.qty, finalStats]
                    );
                } else {
                    // Fallback de seguridad
                    await client.query(`INSERT INTO player_packages (player_id, item_template_id, quantity) VALUES ($1, $2, $3)`, [userId, item.template_id, item.qty]);
                }
            }
        }

        // Cerrar Misión
        await client.query("UPDATE player_quests SET status = 'completed', completed_at = NOW() WHERE id = $1", [playerQuestId]);

        await statisticsService.recordQuestCompleted(userId, {
            type: userQuest.type || null,
            rewards: {
                copper: Number(userQuest.reward_copper || 0),
                silver: Number(userQuest.reward_silver || 0),
                gold: Number(userQuest.reward_gold || 0),
                onix: Number(userQuest.reward_onix || 0)
            }
        }, client);

        await achievementService.incrementProgress(userId, 'quest.complete', 1, {
            source: 'valhalla_hall',
            questId: Number(userQuest.quest_id),
            playerQuestId: Number(playerQuestId),
            questType: userQuest.type || null
        }, client);

        if (Number(userQuest.reward_copper || 0) > 0) {
            await achievementService.incrementProgress(userId, 'economy.copper_earned', Number(userQuest.reward_copper), {
                source: 'quest',
                questId: Number(userQuest.quest_id),
                questType: userQuest.type || null
            }, client);
        }

        if (Number(userQuest.reward_gold || 0) > 0) {
            await achievementService.incrementProgress(userId, 'economy.gold_earned', Number(userQuest.reward_gold), {
                source: 'quest',
                questId: Number(userQuest.quest_id),
                questType: userQuest.type || null
            }, client);
        }

        if (Number(userQuest.reward_onix || 0) > 0) {
            await achievementService.incrementProgress(userId, 'economy.onix_earned', Number(userQuest.reward_onix), {
                source: 'quest',
                questId: Number(userQuest.quest_id),
                questType: userQuest.type || null
            }, client);
        }

        // Lógica Evolución
        let extraMsg = "";
        if (userQuest.type === 'evolution') {
             const pData = await client.query("SELECT pending_class_id, level FROM players WHERE id = $1", [userId]);
             if (pData.rows[0].pending_class_id) {
                 const cls = (await client.query("SELECT name FROM classes WHERE id = $1", [pData.rows[0].pending_class_id])).rows[0];
                 // Actualizar class_id, limpiar pending, marcar evolución completada
                 // NO reemplazar players.stats — los stats entrenados se conservan
                 // NO hacer refund de stat_points — no se resetea la build
                 await client.query("UPDATE players SET class_id = $1, pending_class_id = NULL, evolution_quest_status = 'completed' WHERE id = $2", [pData.rows[0].pending_class_id, userId]);
                 extraMsg = ` ¡Has ascendido a ${cls.name}!`;
             }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Recompensa reclamada.${extraMsg}` });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
};
module.exports = exports;
