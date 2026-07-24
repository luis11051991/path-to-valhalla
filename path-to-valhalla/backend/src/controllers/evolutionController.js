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

        // Filtrar: solo clases con parent_id válido, min_level accesible y raza compatible
        // NO devolver clases base (parent_id IS NOT NULL)
        const parentToSearch = currentClassId || 99999;
        const optionsRes = await pool.query(
            `SELECT * FROM classes 
             WHERE parent_id = $1 
               AND min_level <= $2 
               AND (race_restriction IS NULL OR race_restriction = $3)
               AND parent_id IS NOT NULL`,
            [parentToSearch, player.level, player.race]
        );

        // Buscar la quest de evolución correspondiente al min_level de la opción más baja
        const questRes = await pool.query(
            "SELECT * FROM quests WHERE type = 'evolution' AND min_level <= $1 ORDER BY min_level DESC LIMIT 1", 
            [player.level]
        );
        const questPreview = questRes.rows.length > 0 ? questRes.rows[0] : null;

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[getEvolutionOptions] player=${userId} class_id=${currentClassId} tier=${currentTier} level=${player.level} race=${player.race} options=${optionsRes.rows.length}`);
        }

        res.json({
            available: true,
            currentTier: currentTier,
            options: optionsRes.rows || [],
            questData: questPreview
        });

    } catch (err) {
        console.error('[getEvolutionOptions]', err);
        res.status(500).json({ message: 'Error al buscar evoluciones' });
    }
};

// --- 3. RECONSIDERAR SENDA (Solo nivel 10) ---
exports.reconsiderPath = async (req, res) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const playerRes = await client.query(`
            SELECT p.id, p.level, p.class_id, p.pending_class_id,
                   p.evolution_quest_status, c.tier AS current_tier
            FROM players p
            LEFT JOIN classes c ON p.class_id = c.id
            WHERE p.id = $1
        `, [userId]);
        if (playerRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Jugador no encontrado." });
        }
        const player = playerRes.rows[0];

        if (player.level < 10) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Debes alcanzar el nivel 10 para reconsiderar tu senda." });
        }

        if (player.evolution_quest_status !== 'in_progress') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "No hay una evolución en curso para reconsiderar." });
        }

        if (!player.pending_class_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "No hay una senda pendiente para reconsiderar." });
        }

        const currentTier = player.current_tier !== null ? player.current_tier : 0;
        if (currentTier >= 1) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Ya completaste tu primera evolución. No puedes reconsiderar tu senda." });
        }

        const pendingClassRes = await client.query(
            "SELECT id, tier, min_level, parent_id FROM classes WHERE id = $1",
            [player.pending_class_id]
        );
        if (pendingClassRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "La clase pendiente ya no existe." });
        }
        const pendingClass = pendingClassRes.rows[0];
        if (pendingClass.tier !== 1 || pendingClass.min_level !== 10) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Solo puedes reconsiderar tu primera evolución de nivel 10." });
        }

        const questCheck = await client.query(`
            SELECT pq.id FROM player_quests pq
            JOIN quests q ON pq.quest_id = q.id
            WHERE pq.player_id = $1 AND pq.status = 'active' AND q.type = 'evolution'
        `, [userId]);
        if (questCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "No hay una misión de evolución activa para reconsiderar." });
        }

        await client.query(`
            UPDATE player_quests
            SET status = 'cancelled', completed_at = NULL
            WHERE player_id = $1
              AND status = 'active'
              AND quest_id IN (SELECT id FROM quests WHERE type = 'evolution')
        `, [userId]);

        await client.query(`
            UPDATE players
            SET pending_class_id = NULL, evolution_quest_status = NULL
            WHERE id = $1
        `, [userId]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Los dioses te conceden una nueva oportunidad. Escoge tu senda otra vez." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: "Error al reconsiderar." });
    } finally {
        client.release();
    }
};

// --- 2. INICIAR EL CAMINO (Con protección anti-duplicados) ---
exports.startEvolutionPath = async (req, res) => {
    const userId = req.user.id;
    const { targetClassId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Validar que targetClassId existe
        if (!targetClassId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Debes elegir una clase destino." });
        }

        // 2. Validar que la clase destino existe y cumple requisitos
        const classRes = await client.query(
            "SELECT id, name, parent_id, min_level, race_restriction FROM classes WHERE id = $1",
            [targetClassId]
        );
        if (classRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "La clase destino no existe." });
        }
        const targetClass = classRes.rows[0];

        // 3. Validar datos del jugador
        const playerRes = await client.query(
            "SELECT id, level, race, class_id, pending_class_id, evolution_quest_status FROM players WHERE id = $1",
            [userId]
        );
        if (playerRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Jugador no encontrado' });
        }
        const player = playerRes.rows[0];

        // 4. Validar que no haya una evolución ya en curso
        if (player.pending_class_id || player.evolution_quest_status === 'in_progress') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Ya tienes una evolución en curso." });
        }

        // 5. Validar parent_id — la clase destino debe heredar de la clase actual
        if (targetClass.parent_id !== player.class_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Esta clase no es una evolución válida de tu clase actual." });
        }

        // 6. Validar min_level
        if (targetClass.min_level > player.level) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Necesitas nivel ${targetClass.min_level} para esta evolución.` });
        }

        // 7. Validar raza
        if (targetClass.race_restriction && targetClass.race_restriction !== player.race) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Esta evolución no está disponible para tu raza." });
        }

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