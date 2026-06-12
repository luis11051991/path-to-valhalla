const { db } = require('../config/db');

exports.getEvolutionOptions = async (req, res) => {
    const userId = req.user.id; 

    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado' });
        
        const player = playerDoc.data();
        let currentTier = player.tier != null ? player.tier : 0;
        let currentClassId = player.class_id;

        if (!currentClassId) {
            const baseClassSnap = await db.collection('classes').where('name', '==', player.race).limit(1).get();
            if (!baseClassSnap.empty) currentClassId = Number(baseClassSnap.docs[0].id);
        }

        const optionsSnap = await db.collection('classes')
            .where('parent_id', '==', currentClassId || 99999)
            .get();

        // Buscar la quest de evolucion correspondiente
        const questSnap = await db.collection('quests')
            .where('type', '==', 'evolution')
            .where('min_level', '<=', player.level)
            .orderBy('min_level', 'desc')
            .limit(1)
            .get();
        
        const questPreview = !questSnap.empty ? { ...questSnap.docs[0].data(), id: questSnap.docs[0].id } : null;

        res.json({
            available: true,
            currentTier: currentTier,
            options: optionsSnap.docs.map(d => ({ ...d.data(), id: d.id })),
            questData: questPreview,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al buscar evoluciones' });
    }
};

exports.startEvolutionPath = async (req, res) => {
    const userId = req.user.id;
    const { targetClassId } = req.body;

    try {
        const result = await db.runTransaction(async (t) => {
            // Buscar quest adecuada
            const questSnap = await t.get(
                db.collection('quests')
                    .where('type', '==', 'evolution')
                    .where('min_level', '<=', db.collection('players').doc(userId).get())
                    .limit(1)
            );

            // Alternative approach: read player level first
            const playerDoc = await t.get(db.collection('players').doc(userId));
            if (!playerDoc.exists) throw new Error('player_not_found');
            
            const questQuery = db.collection('quests')
                .where('type', '==', 'evolution')
                .where('min_level', '<=', playerDoc.data().level)
                .limit(1);
            const questSnap2 = await t.get(questQuery);

            if (questSnap2.empty) throw new Error('no_evolution_quest');
            const quest = { ...questSnap2.docs[0].data(), id: questSnap2.docs[0].id };

            // Validacion anti-duplicados
            const playerQuestsSnap = await t.get(
                db.collection('players').doc(userId).collection('quests')
                    .where('status', '==', 'active')
                    .get()
            );
            
            let hasActiveEvolution = false;
            for (const pq of playerQuestsSnap.docs) {
                const pqData = pq.data();
                if (pqData.quest_id === quest.id || pqData.type === 'evolution') {
                    hasActiveEvolution = true;
                    break;
                }
            }

            if (hasActiveEvolution) throw new Error('already_have_evolution_quest');

            // Guardar eleccion
            t.update(db.collection('players').doc(userId), {
                pending_class_id: targetClassId,
                evolution_quest_status: 'in_progress',
            });

            // Insertar quest activa en subcoleccion del jugador
            await t.create(
                db.collection('players').doc(userId).collection('quests').doc(),
                {
                    quest_id: Number(quest.id),
                    status: 'active',
                    progress: {},
                    type: 'evolution',
                    created_at: new Date(),
                }
            );

            return { quest };
        });

        res.json({ success: true, message: 'Los dioses han hablado. Ve al Salon de Valhallus.', quest: result.quest });

    } catch (err) {
        if (err.message === 'player_not_found') return res.status(404).json({ message: 'Jugador no encontrado' });
        if (err.message === 'no_evolution_quest') return res.status(404).json({ message: 'No hay pruebas divinas disponibles.' });
        if (err.message === 'already_have_evolution_quest') return res.status(400).json({ message: 'Ya has aceptado el desafio de los dioses.' });
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};
