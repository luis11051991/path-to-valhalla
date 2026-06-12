const { db } = require('../config/db');
const { hydratePlayer } = require('../shared/player_stats');

// Configuracion de Fondos por Raza
const RACE_BACKGROUNDS = {
    'human': 1, 'elf': 2, 'dwarf': 3, 'orc': 4, 'feline': 5, 'goblin': 6
};

const RACE_CLASSES = {
    'human': 1, 'humano': 1,
    'elf': 2, 'elfo': 2,
    'dwarf': 3, 'enano': 3, 'duende': 3,
    'goblin': 4,
    'orc': 5, 'orco': 5,
    'feline': 6, 'felino': 6
};

exports.chooseRace = async (req, res) => {
    const { userId, race, stats, backgroundId, gender } = req.body;

    try {
        const raceKey = race ? race.toLowerCase() : 'human';
        const correctBgId = RACE_BACKGROUNDS[raceKey] || 1;
        const activeBg = backgroundId || correctBgId;
        const correctClassId = RACE_CLASSES[raceKey] || 1;
        const safeGender = (gender === 'female') ? 'female' : 'male';

        await db.runTransaction(async (t) => {
            t.update(db.collection('players').doc(userId), {
                race: raceKey,
                stats,
                active_background_id: activeBg,
                gender: safeGender,
                class_id: correctClassId,
            });

            // Registrar fondo si no existe
            const bgCheck = await t.get(
                db.collection('player_backgrounds')
                    .where('player_id', '==', userId)
                    .where('background_id', '==', activeBg)
                    .limit(1)
            );
            if (bgCheck.empty) {
                t.create(db.collection('player_backgrounds').doc(), {
                    player_id: userId,
                    background_id: activeBg,
                });
            }
        });

        const finalUserDoc = await db.collection('players').doc(userId).get();
        let finalUser = { ...finalUserDoc.data(), id: finalUserDoc.id };

        // Cargar fondo URL
        const bgDoc = await db.collection('backgrounds').doc(String(activeBg)).get();
        finalUser.active_background_url = bgDoc.exists ? (bgDoc.data().image_url || '') : '';

        // Cargar clase nombre
        const classDoc = await db.collection('classes').doc(String(correctClassId)).get();
        if (classDoc.exists) finalUser.class_name = classDoc.data().name;

        // Inventario y bolsas
        const itemsSnap = await db.collection('players').doc(userId).collection('items').orderBy('bag_slot', 'asc').get();
        const inventoryItems = [];
        for (const itemDoc of itemsSnap.docs) {
            const data = itemDoc.data();
            const tplDoc = await db.collection('items_templates').doc(String(data.template_id)).get();
            if (tplDoc.exists) {
                inventoryItems.push({ ...data, id: itemDoc.id, name: tplDoc.data().name, type: tplDoc.data().type, slot: tplDoc.data().slot, rarity: tplDoc.data().rarity, icon: tplDoc.data().icon, image_url: tplDoc.data().image_url, price_copper: tplDoc.data().price_copper, description: tplDoc.data().description });
            }
        }

        let hydratedUser = hydratePlayer(finalUser, userId);
        hydratedUser.real_inventory = inventoryItems;
        hydratedUser.rented_bags = [];

        res.json({ success: true, user: hydratedUser });
    } catch (err) {
        console.error('Error en chooseRace:', err);
        res.status(500).json({ message: 'Error al elegir raza' });
    }
};

exports.trainStats = async (req, res) => {
    const { userId, newStats, pointsSpent } = req.body;

    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado' });
        const currentUser = playerDoc.data();

        if (currentUser.stat_points < pointsSpent) return res.status(400).json({ message: 'No tienes suficientes puntos.' });

        await db.collection('players').doc(userId).update({
            stats: newStats,
            stat_points: currentUser.stat_points - pointsSpent,
        });

        const finalUserDoc = await db.collection('players').doc(userId).get();
        let finalUser = { ...finalUserDoc.data(), id: playerDoc.id };

        // Background URL
        const bgDoc = await db.collection('backgrounds').doc(String(finalUser.active_background_id || 1)).get();
        finalUser.active_background_url = bgDoc.exists ? (bgDoc.data().image_url || '') : '';

        const itemsSnap = await db.collection('players').doc(userId).collection('items').orderBy('bag_slot', 'asc').get();
        const inventoryItems = [];
        for (const itemDoc of itemsSnap.docs) {
            const data = itemDoc.data();
            const tplDoc = await db.collection('items_templates').doc(String(data.template_id)).get();
            if (tplDoc.exists) {
                inventoryItems.push({ ...data, id: itemDoc.id, name: tplDoc.data().name, type: tplDoc.data().type, slot: tplDoc.data().slot, rarity: tplDoc.data().rarity, icon: tplDoc.data().icon, image_url: tplDoc.data().image_url, price_copper: tplDoc.data().price_copper, description: tplDoc.data().description });
            }
        }

        const hydrated = hydratePlayer(finalUser, userId);
        hydrated.real_inventory = inventoryItems;
        hydrated.rented_bags = [];

        res.json({ success: true, user: hydrated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al entrenar' });
    }
};

exports.rentBag = async (req, res) => {
    const { userId, bagNumber } = req.body;
    const COST = 50; // En copper
    const DAYS = 7;

    try {
        await db.runTransaction(async (t) => {
            const playerDoc = await t.get(db.collection('players').doc(userId));
            if (!playerDoc.exists) throw new Error('player_not_found');
            const p = playerDoc.data();

            if (p.copper < COST) throw new Error('insufficient_funds');

            t.update(db.collection('players').doc(userId), {
                copper: p.copper - COST,
            });

            t.create(db.collection('players').doc(userId).collection('bag_rentals'), {
                bag_number: bagNumber,
                expires_at: new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000),
            });
        });

        const playerDoc = await db.collection('players').doc(userId).get();
        let hydratedUser = hydratePlayer({ ...playerDoc.data(), id: userId }, userId);
        hydratedUser.real_inventory = (await db.collection('players').doc(userId).collection('items').orderBy('bag_slot', 'asc').get()).docs.map(d => {
            const data = d.data();
            return { ...data, id: d.id };
        });
        hydratedUser.rented_bags = [];

        res.json({ success: true, user: hydratedUser, message: 'Bolsa extendida!' });
    } catch (err) {
        if (err.message === 'player_not_found') return res.status(404).json({ message: 'Jugador no encontrado' });
        if (err.message === 'insufficient_funds') return res.status(400).json({ message: 'No tienes suficientes fondos.' });
        console.error(err);
        res.status(500).json({ message: err.message || 'Error al alquilar' });
    }
};

exports.getMySkills = async (req, res) => {
    const userId = req.user.id;
    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado' });
        const classId = playerDoc.data().class_id;

        // Auto-aprender skills de la clase si no los tiene (ACUMULATIVO)
        if (classId) {
            const availableSkillsSnap = await db.collection('skills').where('class_id', '==', classId).get();
            const mySkillsSnap = await db.collection('players').doc(userId).collection('skills').get();
            const learnedIds = new Set(mySkillsSnap.docs.map(d => d.data().skill_id));

            for (const skillDoc of availableSkillsSnap.docs) {
                const skillId = Number(skillDoc.id);
                if (!learnedIds.has(skillId)) {
                    await db.collection('players').doc(userId).collection('skills').add({
                        skill_id: skillId,
                        is_equipped: false,
                        skill_level: 1,
                        slot_index: 0,
                        created_at: new Date(),
                    });
                }
            }
        }

        const mySkillsSnap = await db.collection('players').doc(userId).collection('skills')
            .orderBy('is_equipped', 'desc')
            .orderBy('name', 'asc')
            .get();
        
        // En Firestore no podemos hacer JOIN, asi que cargamos los datos de skills por separado
        const skillIds = [...new Set(mySkillsSnap.docs.map(d => d.data().skill_id))];
        const skillsDataMap = {};
        for (const sid of skillIds) {
            const tplDoc = await db.collection('skills').doc(String(sid)).get();
            if (tplDoc.exists) skillsDataMap[sid] = tplDoc.data();
        }

        const result = mySkillsSnap.docs.map(doc => {
            const ps = doc.data();
            const skillDef = skillsDataMap[ps.skill_id] || {};
            return {
                player_skill_id: doc.id,
                is_equipped: ps.is_equipped,
                skill_level: ps.skill_level,
                ...skillDef,
            };
        });

        res.json({ success: true, skills: result });
    } catch (err) {
        console.error('Error obteniendo skills:', err);
        res.status(500).json({ message: 'Error del servidor al cargar grimorio.' });
    }
};

exports.equipSkill = async (req, res) => {
    const userId = req.user.id;
    const { skillId } = req.body;
    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado' });
        const level = playerDoc.data().level;

        let maxSlots = 2;
        if (level >= 100) maxSlots = 5;
        else if (level >= 50) maxSlots = 4;
        else if (level >= 10) maxSlots = 3;

        const skillRef = db.collection('players').doc(userId).collection('skills').doc(String(skillId));
        const skillDoc = await skillRef.get();
        
        if (!skillDoc.exists) return res.status(400).json({ message: 'Habilidad no encontrada.' });
        const isCurrentlyEquipped = skillDoc.data().is_equipped;

        if (isCurrentlyEquipped) {
            await skillRef.update({ is_equipped: false, slot_index: 0 });
            res.json({ success: true, message: 'Habilidad desequipada.' });
        } else {
            const equippedSnap = await db.collection('players').doc(userId).collection('skills')
                .where('is_equipped', '==', true)
                .get();

            if (equippedSnap.size >= maxSlots) {
                return res.status(400).json({ message: 'Ranuras llenas. Tienes ' + maxSlots + ' espacios disponibles.' });
            }

            const nextSlot = equippedSnap.size + 1;
            await skillRef.update({ is_equipped: true, slot_index: nextSlot });
            res.json({ success: true, message: 'Habilidad equipada.' });
        }
    } catch (err) {
        console.error('Error al equipar skill:', err);
        res.status(500).json({ message: 'Error del servidor.' });
    }
};

exports.searchUsers = async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 3) return res.json([]);

    try {
        // Firestore no tiene ILIKE, usamos startWith para busqueda case-sensitive
        // Para case-insensitive necesitamos filtro en cliente
        const resultSnap = await db.collection('players')
            .where('username', '>=', q)
            .where('username', '<=', q + '\uf8ff')
            .limit(10)
            .get();

        // Filtrar manualmente por prefix match (case-insensitive)
        const results = resultSnap.docs
            .map(d => ({ id: d.id, username: d.data().username }))
            .filter(u => u.username.toLowerCase().startsWith(q.toLowerCase()))
            .slice(0, 10);

        res.json(results);
    } catch (err) {
        console.error('Error buscando usuarios:', err);
        res.status(500).json({ message: 'Error en busqueda' });
    }
};
