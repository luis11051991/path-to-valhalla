const { db } = require('../config/db');
const { hydratePlayer } = require('../shared/player_stats');

exports.getMyPets = async (req, res) => {
    const userId = req.user.id;

    try {
        const myPetsSnap = await db.collection('players').doc(userId).collection('pets').orderBy('is_active', 'desc').get();
        const pets = [];

        for (const petDoc of myPetsSnap.docs) {
            const pData = petDoc.data();
            // Obtener info de la mascota desde el catalogo
            const tplDoc = await db.collection('pets').doc(String(pData.pet_id)).get();
            if (tplDoc.exists) {
                pets.push({
                    player_pet_id: petDoc.id,
                    ...pData,
                    name: tplDoc.data().name,
                    description: tplDoc.data().description,
                    image_url: tplDoc.data().image_url,
                    tier: tplDoc.data().tier,
                    bonus_stats: tplDoc.data().bonus_stats,
                    max_hunger: tplDoc.data().max_hunger || 100,
                    code: tplDoc.data().code,
                });
            }
        }

        res.json({ success: true, pets });
    } catch (err) {
        console.error('Error obteniendo mascotas:', err);
        res.status(500).json({ message: 'Error al cargar el establo.' });
    }
};

exports.equipPet = async (req, res) => {
    const userId = req.user.id;
    const { playerPetId } = req.body;

    try {
        // Desequipar todas las mascotas del jugador
        await db.collection('players').doc(userId).collection('pets')
            .where('is_active', '==', true)
            .get()
            .then(snap => {
                const batch = db.batch();
                snap.docs.forEach(doc => batch.update(doc.ref, { is_active: false }));
                return batch.commit();
            });

        // Equipar la seleccionada
        await db.collection('players').doc(userId).collection('pets').doc(playerPetId).update({ is_active: true });

        const myPetsSnap = await db.collection('players').doc(userId).collection('pets')
            .orderBy('is_active', 'desc')
            .get();
        
        const pets = [];
        for (const petDoc of myPetsSnap.docs) {
            const pData = petDoc.data();
            const tplDoc = await db.collection('pets').doc(String(pData.pet_id)).get();
            if (tplDoc.exists) {
                pets.push({
                    player_pet_id: petDoc.id, ...pData, name: tplDoc.data().name, description: tplDoc.data().description,
                    image_url: tplDoc.data().image_url, tier: tplDoc.data().tier, bonus_stats: tplDoc.data().bonus_stats,
                    max_hunger: tplDoc.data().max_hunger || 100, code: tplDoc.data().code,
                });
            }
        }

        const hydrated = hydratePlayer(userId);
        const bgDoc = await db.collection('backgrounds').doc(String(hydrated.active_background_id || 1)).get();

        res.json({ success: true, pets, user: { ...hydrated, active_background_url: bgDoc.exists ? (bgDoc.data().image_url || '') : '', real_inventory: [], rented_bags: [] } });

    } catch (err) {
        console.error('Error equipando mascota:', err);
        res.status(500).json({ message: 'No se pudo equipar la mascota.' });
    }
};

exports.feedPet = async (req, res) => {
    const userId = req.user.id;
    const { playerPetId } = req.body;
    const HEAL_AMOUNT = 20;

    try {
        const petDoc = await db.collection('players').doc(userId).collection('pets').doc(playerPetId).get();
        if (!petDoc.exists) return res.status(404).json({ message: 'Mascota no encontrada.' });
        
        const petData = petDoc.data();
        // Obtener tier desde el catalogo
        const tplDoc = await db.collection('pets').doc(String(petData.pet_id)).get();
        const tier = tplDoc.exists ? tplDoc.data().tier : 1;

        if (petData.current_hunger >= 100) return res.status(400).json({ message: 'Tu mascota ya esta llena.' });

        // Costos por tier
        let costCopperVal = 0, costText = '';
        if (tier === 1) { costCopperVal = 10; costText = '10 de Cobre'; }
        else if (tier === 2) { costCopperVal = 500; costText = '5 de Plata'; }
        else if (tier >= 3) { costCopperVal = 10000; costText = '1 de Oro'; }

        const playerDoc = await db.collection('players').doc(userId).get();
        const p = playerDoc.data();
        const currentTotalCopper = (parseInt(p.gold || 0) * 10000) + (parseInt(p.silver || 0) * 100) + parseInt(p.copper);

        if (currentTotalCopper < costCopperVal) {
            return res.status(400).json({ message: 'No tienes suficiente dinero. Necesitas ' + costText + '.' });
        }

        await db.runTransaction(async (t) => {
            const playerRef = db.collection('players').doc(userId);
            const playerDoc2 = await t.get(playerRef);
            const p2 = playerDoc2.data();
            const newTotalCopper = currentTotalCopper - costCopperVal;

            t.update(playerRef, {
                gold: Math.floor(newTotalCopper / 10000),
                silver: Math.floor((newTotalCopper % 10000) / 100),
                copper: newTotalCopper % 100,
            });

            t.update(db.collection('players').doc(userId).collection('pets').doc(playerPetId), {
                current_hunger: Math.min(100, petData.current_hunger + HEAL_AMOUNT),
            });
        });

        res.json({ 
            success: true, 
            message: 'Mascota alimentada (+' + HEAL_AMOUNT + '). Pagaste ' + costText + '.',
            newMoney: { gold: Math.floor((currentTotalCopper - costCopperVal) / 10000), silver: Math.floor(((currentTotalCopper - costCopperVal) % 10000) / 100), copper: (currentTotalCopper - costCopperVal) % 100 },
        });

    } catch (err) {
        console.error('Error alimentando:', err);
        res.status(500).json({ message: 'Error al procesar el pago.' });
    }
};

exports.decreasePetHungerInternal = async (userId, hungerAmount = 1) => {
    try {
        const activeSnap = await db.collection('players').doc(userId).collection('pets')
            .where('is_active', '==', true)
            .limit(1)
            .get();

        if (activeSnap.empty) return false;

        const petDoc = activeSnap.docs[0];
        let newHunger = petDoc.data().current_hunger - hungerAmount;
        if (newHunger < 0) newHunger = 0;

        await db.collection('players').doc(userId).collection('pets').doc(petDoc.id).update({ current_hunger: newHunger });
        return true;
    } catch (err) {
        console.error('Error desgastando mascota:', err);
        return false;
    }
};
