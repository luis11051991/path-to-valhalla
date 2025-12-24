const pool = require('../config/db');

// Helper: Calcular Cooldown en Segundos según Nivel
const getCooldownSeconds = (level) => {
    if (level <= 5) return 30;
    if (level <= 10) return 60;
    if (level <= 15) return 90;
    if (level <= 20) return 120;
    return 180;
};

// 1. OBTENER ESTADO COMPLETO (Salón y Dashboard)
exports.getQuestStatus = async (req, res) => {
    const userId = req.user.id;
    const { context } = req.query; 

    try {
        const playerRes = await pool.query('SELECT level, last_quest_accepted_at, evolution_quest_status FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        // --- CONTEXTO: EVOLUCIÓN (Botón Dashboard) ---
        if (context === 'evolution') {
            // 1. Buscamos si tiene la misión de evolución ACTIVA en la tabla de misiones
            const evoQuestRes = await pool.query(`
                SELECT pq.*, q.title, q.description, q.requirements, p.pending_class_id
                FROM player_quests pq
                JOIN quests q ON pq.quest_id = q.id
                JOIN players p ON pq.player_id = p.id
                WHERE pq.player_id = $1 AND q.type = 'evolution' AND pq.status = 'active'
            `, [userId]);

            // Si tiene misión activa, devolvemos estado 'in_progress'
            if (evoQuestRes.rows.length > 0) {
                const pendingClassId = evoQuestRes.rows[0].pending_class_id;
                let classInfo = null;
                if (pendingClassId) {
                    const cRes = await pool.query("SELECT name, image_url FROM classes WHERE id = $1", [pendingClassId]);
                    if (cRes.rows.length > 0) classInfo = cRes.rows[0];
                }
                return res.json({ 
                    status: 'in_progress', 
                    quest: evoQuestRes.rows[0], 
                    targetClass: classInfo 
                });
            }

            // --- CORRECCIÓN CRÍTICA AQUÍ ---
            // Si NO tiene misión activa (pasó el if de arriba), verificamos si puede empezar.
            // Antes bloqueábamos si el estado era 'in_progress'. Ahora solo bloqueamos si es 'completed'.
            // Esto arregla el "estado zombie".
            if (player.level >= 10 && player.evolution_quest_status !== 'completed') {
                return res.json({ status: 'available' });
            }
            
            // Si ya completó o es nivel bajo, devolvemos el estado real
            const finalStatus = player.evolution_quest_status === 'completed' ? 'completed' : 'locked';
            return res.json({ status: finalStatus });
        }

        // --- CONTEXTO: VALHALLA HALL (Diarias) ---
        if (context === 'hall') {
            // A. Misiones Activas
            const activeQuestsRes = await pool.query(`
                SELECT pq.*, q.title, q.description, q.requirements, q.type, q.reward_xp, q.reward_gold
                FROM player_quests pq
                JOIN quests q ON pq.quest_id = q.id
                WHERE pq.player_id = $1 AND pq.status = 'active' AND q.type != 'evolution'
            `, [userId]);

            // B. Misiones Disponibles
            const poolRes = await pool.query(`
                SELECT * FROM quests 
                WHERE type IN ('daily', 'weekly') 
                AND min_level <= $1
                AND id NOT IN (
                    SELECT quest_id FROM player_quests WHERE player_id = $2 AND status = 'active'
                )
                ORDER BY RANDOM() LIMIT 6
            `, [player.level, userId]);

            // C. Cooldown
            let acceptCooldown = 0;
            if (player.last_quest_accepted_at) {
                const diff = (new Date() - new Date(player.last_quest_accepted_at)) / 1000;
                if (diff < 300) acceptCooldown = Math.ceil(300 - diff);
            }

            return res.json({
                activeQuests: activeQuestsRes.rows,
                availableQuests: poolRes.rows,
                maxSlots: getMaxQuestSlots(player.level),
                acceptCooldown
            });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error en misiones." });
    }
};

// 2. ACEPTAR MISIÓN
exports.acceptQuest = async (req, res) => {
    const userId = req.user.id;
    const { questId } = req.body; 

    try {
        const playerRes = await pool.query('SELECT level, last_quest_accepted_at FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        const qTypeRes = await pool.query("SELECT type FROM quests WHERE id = $1", [questId]);
        if (qTypeRes.rows.length === 0) return res.status(404).json({ message: "Misión no encontrada." });
        const isEvolution = qTypeRes.rows[0].type === 'evolution';

        if (!isEvolution && player.last_quest_accepted_at) {
            const diff = (new Date() - new Date(player.last_quest_accepted_at)) / 1000;
            if (diff < 300) return res.status(400).json({ message: `Espera ${Math.ceil(300 - diff)}s.` });
        }

        if (!isEvolution) {
            const maxSlots = getMaxQuestSlots(player.level);
            const countRes = await pool.query(`
                SELECT COUNT(*) FROM player_quests pq JOIN quests q ON pq.quest_id = q.id 
                WHERE pq.player_id = $1 AND pq.status = 'active' AND q.type != 'evolution'
            `, [userId]);
            if (parseInt(countRes.rows[0].count) >= maxSlots) return res.status(400).json({ message: `Límite de misiones alcanzado.` });
        }

        const dupCheck = await pool.query("SELECT id FROM player_quests WHERE player_id = $1 AND quest_id = $2 AND status = 'active'", [userId, questId]);
        if (dupCheck.rows.length > 0) return res.status(400).json({ message: "Ya tienes esta misión." });

        await pool.query("INSERT INTO player_quests (player_id, quest_id, status, progress) VALUES ($1, $2, 'active', '{}')", [userId, questId]);

        if (!isEvolution) {
            await pool.query("UPDATE players SET last_quest_accepted_at = NOW() WHERE id = $1", [userId]);
        }

        res.json({ success: true, message: "Misión aceptada." });

    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: "Misión ya activa." });
        res.status(500).json({ message: "Error al aceptar." });
    }
};

// 3. REFRESCAR TABLÓN
exports.refreshBoard = async (req, res) => {
    res.json({ success: true, message: "Tablón actualizado." });
};

// 4. COMPLETAR
exports.completeQuest = async (req, res) => {
    const userId = req.user.id;
    const { playerQuestId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pqRes = await client.query(`
            SELECT pq.*, q.requirements, q.reward_xp, q.reward_gold, q.reward_items, q.type
            FROM player_quests pq
            JOIN quests q ON pq.quest_id = q.id
            WHERE pq.id = $1 AND pq.player_id = $2 AND pq.status = 'active'
        `, [playerQuestId, userId]);

        if (pqRes.rows.length === 0) throw new Error("Misión no válida.");
        const userQuest = pqRes.rows[0];
        const progress = userQuest.progress || {};
        
        let isComplete = true;
        (userQuest.requirements || []).forEach(req => {
            const current = progress[req.target_id || req.type] || 0;
            if (current < req.count) isComplete = false;
        });

        if (!isComplete) throw new Error("Objetivos incompletos.");

        await client.query(`UPDATE players SET experience = experience + $1, gold = gold + $2 WHERE id = $3`, [userQuest.reward_xp || 0, userQuest.reward_gold || 0, userId]);
        
        if (userQuest.reward_items && Array.isArray(userQuest.reward_items)) {
            for (const item of userQuest.reward_items) {
                await client.query(`INSERT INTO player_packages (player_id, item_template_id, quantity) VALUES ($1, $2, $3)`, [userId, item.template_id, item.qty]);
            }
        }

        await client.query("UPDATE player_quests SET status = 'completed', completed_at = NOW() WHERE id = $1", [playerQuestId]);

        let extraMsg = "";
        if (userQuest.type === 'evolution') {
             const pData = await client.query("SELECT pending_class_id, level FROM players WHERE id = $1", [userId]);
             if (pData.rows[0].pending_class_id) {
                 const cls = (await client.query("SELECT base_stats, name FROM classes WHERE id = $1", [pData.rows[0].pending_class_id])).rows[0];
                 const refund = (pData.rows[0].level - 1) * 5;
                 await client.query("UPDATE players SET class_id = $1, pending_class_id = NULL, stats = $2, stat_points = $3, evolution_quest_status = 'completed' WHERE id = $4", [pData.rows[0].pending_class_id, cls.base_stats, refund, userId]);
                 extraMsg = ` ¡Has evolucionado a ${cls.name}!`;
             }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Misión Completada.${extraMsg}` });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: e.message });
    } finally {
        client.release();
    }
};

module.exports = exports;