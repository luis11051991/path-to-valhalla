const { db } = require('../config/db');

exports.upgradeSkill = async (req, res) => {
    const userId = req.user.id;
    const { playerSkillId } = req.body;

    try {
        // 1) Cargar skill data y verificar ownership
        const skillDoc = await db.collection('players').doc(userId).collection('skills').doc(String(playerSkillId)).get();
        if (!skillDoc.exists || skillDoc.data().player_id !== userId) throw new Error('Habilidad no encontrada o no te pertenece.');

        const skillData = skillDoc.data();
        // Cargar datos de la skill desde el catalogo
        const tplDoc = await db.collection('skills').doc(String(skillData.skill_id)).get();
        if (!tplDoc.exists) throw new Error('Skill template not found');
        
        const currentLevel = Number(skillData.skill_level) || 1;
        const maxLevel = Number(tplDoc.data().max_level) || 10;
        const basePriceInCopper = Number(tplDoc.data().price_gold || 100);

        if (currentLevel >= maxLevel) throw new Error('Esta habilidad ya esta en su nivel maximo!');

        // Calcular costo
        const costInCopper = Math.floor(basePriceInCopper * Math.pow(1.3, currentLevel - 1));

        // 2) Verificar fondos del jugador
        const playerDoc = await db.collection('players').doc(userId).get();
        const p = playerDoc.data();
        let totalCopper = (Number(p.gold || 0) * 10000) + (Number(p.silver || 0) * 100) + Number(p.copper || 0);

        if (totalCopper < costInCopper) {
            const g = Math.floor(costInCopper / 10000);
            const s = Math.floor((costInCopper % 10000) / 100);
            const c = costInCopper % 100;
            throw new Error('Fondos insuficientes. Costo: ' + g + 'g ' + s + 's ' + c + 'c');
        }

        // 3) Cobrar y actualizar skill
        totalCopper -= costInCopper;

        await db.runTransaction(async (t) => {
            t.update(db.collection('players').doc(userId), {
                gold: Math.floor(totalCopper / 10000),
                silver: Math.floor((totalCopper % 10000) / 100),
                copper: totalCopper % 100,
            });
            t.update(db.collection('players').doc(userId).collection('skills').doc(String(playerSkillId)), {
                skill_level: currentLevel + 1,
            });
        });

        res.json({ success: true, message: tplDoc.data().name + ' subio a Nivel ' + (currentLevel + 1) + '!', newLevel: currentLevel + 1 });

    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
};
