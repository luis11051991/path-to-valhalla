const pool = require('../config/db');

// --- MEJORAR HABILIDAD (Coste de Oro) ---
exports.upgradeSkill = async (req, res) => {
    const userId = req.user.id;
    const { playerSkillId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Obtener datos de la habilidad y del jugador
        const skillQuery = `
            SELECT ps.id, ps.skill_level, ps.player_id, 
                   s.name, s.price_gold, s.max_level
            FROM player_skills ps
            JOIN skills s ON ps.skill_id = s.id
            WHERE ps.id = $1 AND ps.player_id = $2
        `;
        const skillRes = await client.query(skillQuery, [playerSkillId, userId]);

        if (skillRes.rows.length === 0) {
            throw new Error("Habilidad no encontrada o no te pertenece.");
        }

        const skill = skillRes.rows[0];
        const currentLevel = skill.skill_level || 1;
        const maxLevel = skill.max_level || 10;

        // 2. Validar Nivel Máximo
        if (currentLevel >= maxLevel) {
            throw new Error("¡Esta habilidad ya está en su nivel máximo!");
        }

        // 3. Calcular Costo (Fórmula: Precio Base * Nivel Actual)
        const cost = (skill.price_gold || 100) * currentLevel;

        // 4. Verificar Oro del Jugador
        const playerRes = await client.query('SELECT gold, silver, copper FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];
        
        // Convertimos todo a cobre para facilitar la resta
        let totalCopper = (player.gold * 10000) + (player.silver * 100) + player.copper;
        const costInCopper = cost * 10000; // El precio base suele estar en Oro en la DB, ajusta si es cobre

        if (totalCopper < costInCopper) {
            throw new Error(`Necesitas ${cost} Oro para mejorar esta habilidad.`);
        }

        // 5. Cobrar y Mejorar
        totalCopper -= costInCopper;
        const newGold = Math.floor(totalCopper / 10000);
        const remainder = totalCopper % 10000;
        const newSilver = Math.floor(remainder / 100);
        const newCopper = remainder % 100;

        await client.query(
            'UPDATE players SET gold = $1, silver = $2, copper = $3 WHERE id = $4',
            [newGold, newSilver, newCopper, userId]
        );

        await client.query(
            'UPDATE player_skills SET skill_level = $1 WHERE id = $2',
            [currentLevel + 1, playerSkillId]
        );

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: `¡${skill.name} subió a Nivel ${currentLevel + 1}!`,
            newLevel: currentLevel + 1,
            newFunds: { gold: newGold, silver: newSilver, copper: newCopper }
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
};