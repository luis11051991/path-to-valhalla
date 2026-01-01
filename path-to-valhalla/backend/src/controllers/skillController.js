const pool = require('../config/db');

// Upgrade skill using copper-based pricing
exports.upgradeSkill = async (req, res) => {
    const userId = req.user.id;
    const { playerSkillId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1) Load skill data and verify ownership
        const skillQuery = `
            SELECT ps.id, ps.skill_level, ps.player_id,
                   s.name, s.price_gold AS base_price, s.max_level
            FROM player_skills ps
            JOIN skills s ON ps.skill_id = s.id
            WHERE ps.id = $1 AND ps.player_id = $2
        `;
        const skillRes = await client.query(skillQuery, [playerSkillId, userId]);

        if (skillRes.rows.length === 0) {
            throw new Error('Habilidad no encontrada o no te pertenece.');
        }

        const skill = skillRes.rows[0];
        const currentLevel = Number(skill.skill_level) || 1;
        const maxLevel = Number(skill.max_level) || 10;

        if (currentLevel >= maxLevel) {
            throw new Error('Esta habilidad ya esta en su nivel maximo!');
        }

        // DB stores price_gold already in copper (e.g. 10000 = 1 gold)
        const basePriceInCopper = Number(skill.base_price ?? 100);
        const costInCopper = Math.floor(basePriceInCopper * Math.pow(1.3, currentLevel - 1));

        // 2) Check player funds
        const playerRes = await client.query('SELECT gold, silver, copper FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        const gold = Number(player.gold) || 0;
        const silver = Number(player.silver) || 0;
        const copper = Number(player.copper) || 0;
        let totalCopper = (gold * 10000) + (silver * 100) + copper;

        if (totalCopper < costInCopper) {
            const g = Math.floor(costInCopper / 10000);
            const s = Math.floor((costInCopper % 10000) / 100);
            const c = costInCopper % 100;
            throw new Error(`Fondos insuficientes. Costo: ${g}g ${s}s ${c}c`);
        }

        // 3) Charge player and upgrade skill
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
            message: `${skill.name} subio a Nivel ${currentLevel + 1}!`,
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
