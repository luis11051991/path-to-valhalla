const pool = require('../config/db');
const { normalizeCurrency } = require('../utils/currencyUtils');
const { getRequiredXp } = require('../shared/level_xp');

// ConfiguraciÃ³n
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

        // --- CONTEXTO: EVOLUCIÃ“N (Sin cambios) ---
        if (context === 'evolution') {
            const evoQuestRes = await client.query(`SELECT pq.*, q.title, q.description, q.requirements, p.pending_class_id FROM player_quests pq JOIN quests q ON pq.quest_id = q.id JOIN players p ON pq.player_id = p.id WHERE pq.player_id = $1 AND q.type = 'evolution' AND pq.status = 'active'`, [userId]);
            if (evoQuestRes.rows.length > 0) {
                const pendingClassId = evoQuestRes.rows[0].pending_class_id;
                let classInfo = null;
                if (pendingClassId) {
                    const cRes = await client.query("SELECT name, image_url FROM classes WHERE id = $1", [pendingClassId]);
                    if (cRes.rows.length > 0) classInfo = cRes.rows[0];
                }
                await client.query('COMMIT');
                return res.json({ status: 'in_progress', quest: evoQuestRes.rows[0], targetClass: classInfo });
            }
            await client.query('COMMIT');
            if (player.level >= 10 && player.evolution_quest_status !== 'completed') return res.json({ status: 'available' });
            return res.json({ status: player.evolution_quest_status === 'completed' ? 'completed' : 'locked' });
        }

        // --- CONTEXTO: SALÃ“N DE VALHALLUS ---
        if (context === 'hall') {
            
            // 1. LOGICA SEMANAL (AUTO-ASIGNAR)
            // Verificamos si tiene misiones semanales activas O completadas recientemente (esta semana)
            // Para simplificar: Si no tiene NINGUNA semanal activa, le asignamos 3 nuevas.
            const weeklyCheck = await client.query(`
                SELECT pq.id FROM player_quests pq 
                JOIN quests q ON pq.quest_id = q.id 
                WHERE pq.player_id = $1 AND q.type = 'weekly' AND pq.status = 'active'
            `, [userId]);

            if (weeklyCheck.rows.length === 0) {
                // No tiene semanales activas. Asignamos 3 aleatorias de su nivel.
                const newWeeklies = await client.query(`
                    SELECT id FROM quests 
                    WHERE type = 'weekly' AND min_level <= $1 
                    ORDER BY RANDOM() LIMIT 3
                `, [player.level]);

                for (const q of newWeeklies.rows) {
                    // Verificar que no la haya completado hoy (opcional, para evitar farm infinito si borras)
                    // Insertamos
                    await client.query("INSERT INTO player_quests (player_id, quest_id, status, progress) VALUES ($1, $2, 'active', '{}')", [userId, q.id]);
                }
            }

            // 2. RECUPERAR TODAS LAS ACTIVAS (Diarias y Semanales)
            const allActiveRes = await client.query(`
                SELECT pq.*, q.title, q.description, q.requirements, q.type, q.min_level, q.reward_xp, q.reward_gold, q.reward_silver, q.reward_copper
                FROM player_quests pq
                JOIN quests q ON pq.quest_id = q.id
                WHERE pq.player_id = $1 AND pq.status = 'active' AND q.type != 'evolution'
            `, [userId]);

            // Separamos en arrays para el frontend
            const dailyActive = allActiveRes.rows.filter(q => q.type === 'daily');
            const weeklyActive = allActiveRes.rows.filter(q => q.type === 'weekly');

            // 3. RECUPERAR TABLÃ“N DISPONIBLE (Solo Diarias)
            // Filtro inteligente: Muestra misiones cercanas a tu nivel (ORDER BY min_level DESC)
            const dailyAvailable = await client.query(`
                SELECT * FROM quests 
                WHERE type = 'daily' 
                AND min_level <= $1
                AND id NOT IN (SELECT quest_id FROM player_quests WHERE player_id = $2 AND status = 'active')
                ORDER BY min_level DESC, RANDOM() 
                LIMIT 6
            `, [player.level, userId]);

            // 4. CALCULAR COOLDOWN COMPARTIDO
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
                globalCooldown // Un solo timer para todo
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

// 2. ACEPTAR MISIÃ“N (Solo Diarias - Activa Cooldown Global)
exports.acceptQuest = async (req, res) => {
    const userId = req.user.id;
    const { questId } = req.body; 

    try {
        const playerRes = await pool.query('SELECT level, last_hall_action_at FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        // Validar Cooldown Global
        if (player.last_hall_action_at) {
            const diff = (new Date() - new Date(player.last_hall_action_at)) / 1000;
            if (diff < 300) return res.status(400).json({ message: `Debes esperar ${Math.ceil(300 - diff)}s para realizar otra acciÃ³n.` });
        }

        // Validar Slots (Solo aplica a diarias)
        const maxSlots = getMaxQuestSlots(player.level);
        const countRes = await pool.query(`
            SELECT COUNT(*) FROM player_quests pq JOIN quests q ON pq.quest_id = q.id 
            WHERE pq.player_id = $1 AND pq.status = 'active' AND q.type = 'daily'
        `, [userId]);
        
        if (parseInt(countRes.rows[0].count) >= maxSlots) {
            return res.status(400).json({ message: `LÃ­mite de misiones diarias alcanzado (${maxSlots}).` });
        }

        // Insertar y Activar Cooldown
        await pool.query("INSERT INTO player_quests (player_id, quest_id, status, progress) VALUES ($1, $2, 'active', '{}')", [userId, questId]);
        await pool.query("UPDATE players SET last_hall_action_at = NOW() WHERE id = $1", [userId]);

        res.json({ success: true, message: "Contrato firmado. (Cooldown activado)" });

    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: "MisiÃ³n ya activa." });
        res.status(500).json({ message: "Error al aceptar." });
    }
};

// 3. REFRESCAR TABLÃ“N (Solo Diarias - Activa Cooldown Global)
exports.refreshBoard = async (req, res) => {
    const userId = req.user.id;
    
    try {
        const playerRes = await pool.query('SELECT last_hall_action_at FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        if (player.last_hall_action_at) {
            const diff = (new Date() - new Date(player.last_hall_action_at)) / 1000;
            if (diff < 300) return res.status(400).json({ message: `Debes esperar ${Math.ceil(300 - diff)}s.` });
        }

        // Simplemente actualizamos el timestamp para bloquear acciones y el frontend recargarÃ¡ con RANDOM()
        await pool.query("UPDATE players SET last_hall_action_at = NOW() WHERE id = $1", [userId]);

        res.json({ success: true, message: "TablÃ³n actualizado. (Cooldown activado)" });
    } catch (err) {
        res.status(500).json({ message: "Error al refrescar." });
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
            SELECT pq.*, q.requirements, q.reward_xp, q.reward_gold, q.reward_silver, q.reward_copper, q.reward_items, q.type
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

        // Datos jugador para XP/nivel/puntos
        const playerData = (await client.query("SELECT level, experience, stat_points, gold, silver, copper FROM players WHERE id = $1", [userId])).rows[0];
        let currentLevel = parseInt(playerData.level || 1);
        let currentXp = parseInt(playerData.experience || 0);
        let currentStatPoints = parseInt(playerData.stat_points || 0);

        // Calcular economía
        const rewardTotal = ((userQuest.reward_gold || 0) * 10000) + ((userQuest.reward_silver || 0) * 100) + (userQuest.reward_copper || 0);
        const normalized = normalizeCurrency(playerData.gold || 0, playerData.silver || 0, playerData.copper || 0, rewardTotal);

        // Aplicar XP y subir nivel (5 puntos por nivel como en expediciones)
        currentXp += (userQuest.reward_xp || 0);
        while (true) {
            const needed = getRequiredXp(currentLevel);
            if (currentXp >= needed) {
                currentXp -= needed;
                currentLevel += 1;
                currentStatPoints += 5;
            } else break;
        }

        // Guardar recompensas y progreso de jugador
        await client.query(
            `UPDATE players 
             SET experience = $1, level = $2, stat_points = $3, gold = $4, silver = $5, copper = $6 
             WHERE id = $7`,
            [currentXp, currentLevel, currentStatPoints, normalized.newGold, normalized.newSilver, normalized.newCopper, userId]
        );
        
        if (userQuest.reward_items) {
            for (const item of userQuest.reward_items) {
                await client.query(`INSERT INTO player_packages (player_id, item_template_id, quantity) VALUES ($1, $2, $3)`, [userId, item.template_id, item.qty]);
            }
        }

        // Cerrar Misión
        await client.query("UPDATE player_quests SET status = 'completed', completed_at = NOW() WHERE id = $1", [playerQuestId]);

        // Lógica Evolución
        let extraMsg = "";
        if (userQuest.type === 'evolution') {
             const pData = await client.query("SELECT pending_class_id, level FROM players WHERE id = $1", [userId]);
             if (pData.rows[0].pending_class_id) {
                 const cls = (await client.query("SELECT base_stats, name FROM classes WHERE id = $1", [pData.rows[0].pending_class_id])).rows[0];
                 const refund = (pData.rows[0].level - 1) * 5;
                 await client.query("UPDATE players SET class_id = $1, pending_class_id = NULL, stats = $2, stat_points = $3, evolution_quest_status = 'completed' WHERE id = $4", [pData.rows[0].pending_class_id, cls.base_stats, refund, userId]);
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

