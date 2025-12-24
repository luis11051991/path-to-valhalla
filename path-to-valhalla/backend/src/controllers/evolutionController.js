const pool = require('../config/db');

// --- 1. OBTENER OPCIONES DE EVOLUCIÓN ---
exports.getEvolutionOptions = async (req, res) => {
    const userId = req.user.id; 

    try {
        const playerQuery = `
            SELECT p.id, p.level, p.race, p.class_id, c.tier, c.name as class_name
            FROM players p
            LEFT JOIN classes c ON p.class_id = c.id
            WHERE p.id = $1
        `;
        const playerRes = await pool.query(playerQuery, [userId]);
        if (playerRes.rows.length === 0) return res.status(404).json({ message: 'Jugador no encontrado' });
        
        const player = playerRes.rows[0];
        let currentTier = player.tier !== null ? player.tier : 0;
        let currentClassId = player.class_id;

        if (!currentClassId) {
            const baseClassRes = await pool.query("SELECT id FROM classes WHERE name ILIKE $1", [player.race]);
            if (baseClassRes.rows.length > 0) currentClassId = baseClassRes.rows[0].id;
        }

        const optionsQuery = `SELECT * FROM classes WHERE parent_id = $1`;
        const parentToSearch = currentClassId || 99999;
        const optionsRes = await pool.query(optionsQuery, [parentToSearch]);

        res.json({
            available: true,
            currentTier: currentTier,
            options: optionsRes.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al buscar evoluciones' });
    }
};

// --- 2. INICIAR EL CAMINO (Con protección anti-duplicados) ---
exports.startEvolutionPath = async (req, res) => {
    const userId = req.user.id;
    const { targetClassId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Buscar quest adecuada
        const questRes = await client.query("SELECT * FROM quests WHERE type = 'evolution' AND min_level <= (SELECT level FROM players WHERE id = $1) ORDER BY min_level DESC LIMIT 1", [userId]);
        
        if (questRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "No hay pruebas divinas disponibles." });
        }
        const quest = questRes.rows[0];

        // --- VALIDACIÓN DOBLE: Por Quest ID Específico O por Tipo 'evolution' ---
        const check = await client.query(`
            SELECT pq.id FROM player_quests pq
            JOIN quests q ON pq.quest_id = q.id
            WHERE pq.player_id = $1 AND pq.status = 'active' AND (pq.quest_id = $2 OR q.type = 'evolution')
        `, [userId, quest.id]);

        if (check.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Ya has aceptado el desafío de los dioses." });
        }

        // Guardar elección
        await client.query("UPDATE players SET pending_class_id = $1, evolution_quest_status = 'in_progress' WHERE id = $2", [targetClassId, userId]);
        
        await client.query(
            "INSERT INTO player_quests (player_id, quest_id, status, progress) VALUES ($1, $2, 'active', '{}')",
            [userId, quest.id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Los dioses han hablado. Ve al Salón de Valhallus.", quest });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
};