const { db } = require('../config/db');
const { normalizeCurrency } = require('../utils/currencyUtils');
const { getRequiredXp } = require('../shared/level_xp');

const generateQuestItemStats = (templateStats) => {
    const finalStats = {};
    if (!templateStats) return {};
    for (const [key, value] of Object.entries(templateStats)) {
        if (Array.isArray(value) && value.length === 2) {
            finalStats[key] = Math.floor(Math.random() * (value[1] - value[0] + 1)) + value[0];
        } else {
            finalStats[key] = value;
        }
    }
    return finalStats;
};

const getMaxQuestSlots = (level) => {
    if (level >= 40) return 5;
    if (level >= 21) return 4;
    if (level >= 11) return 3;
    return 2;
};

// Helper: obtener cooldown para contexto hall
const getGlobalCooldown = async (userId) => {
    const playerDoc = await db.collection('players').doc(userId).get();
    if (!playerDoc.exists) return { globalCooldown: 0, lastHallActionAt: null };
    const lastAction = playerDoc.data().last_hall_action_at;
    if (!lastAction) return { globalCooldown: 0, lastHallActionAt: null };

    const lastActionTime = lastAction.toDate ? lastAction.toDate() : new Date(lastAction);
    const now = new Date();
    const diffMinutes = (now - lastActionTime) / (1000 * 60);
    
    if (diffMinutes < 30) {
        return { globalCooldown: Math.ceil(30 - diffMinutes), lastHallActionAt: lastActionTime.toISOString() };
    }
    return { globalCooldown: 0, lastHallActionAt: lastActionTime.toISOString() };
};

exports.getQuestStatus = async (req, res) => {
    const userId = req.user.id;
    const context = req.query.context || 'hall'; 

    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado' });
        const player = playerDoc.data();

        if (context === 'evolution') {
            const evoSnap = await db.collection('players').doc(userId).collection('quests')
                .where('type', '==', 'evolution')
                .where('status', '==', 'active')
                .limit(1)
                .get();
            
            if (!evoSnap.empty) {
                const pqData = evoSnap.docs[0].data();
                let classInfo = null;
                if (pqData.pending_class_id) {
                    const cDoc = await db.collection('classes').doc(String(pqData.pending_class_id)).get();
                    if (cDoc.exists) classInfo = { name: cDoc.data().name, image_url: cDoc.data().image_url };
                }
                return res.json({ status: 'in_progress', quest: { ...pqData, id: evoSnap.docs[0].id }, targetClass: classInfo });
            }

            if (player.level >= 10 && player.evolution_quest_status !== 'completed') return res.json({ status: 'available' });
            return res.json({ status: player.evolution_quest_status === 'completed' ? 'completed' : 'locked' });
        }

        // Hall context
        // Auto-asignar quests semanales si no tiene
        const weeklySnap = await db.collection('players').doc(userId).collection('quests')
            .where('type', '==', 'weekly')
            .where('status', '==', 'active')
            .get();

        if (weeklySnap.empty) {
            // Seleccionar 3 quests semanales aleatorias disponibles
            const availableWeekly = await db.collection('quests')
                .where('type', '==', 'weekly')
                .where('min_level', '<=', player.level)
                .limit(3)
                .get();

            for (const qDoc of availableWeekly.docs) {
                await db.collection('players').doc(userId).collection('quests').add({
                    quest_id: Number(qDoc.id), title: qDoc.data().title, description: qDoc.data().description,
                    requirements: qDoc.data().requirements || [], progress: {}, type: 'weekly',
                    min_level: qDoc.data().min_level, reward_xp: qDoc.data().reward_xp, reward_gold: qDoc.data().reward_gold,
                    reward_silver: qDoc.data().reward_silver, reward_copper: qDoc.data().reward_copper,
                    status: 'active', created_at: new Date(),
                });
            }
        }

        // Recuperar todas las activas
        const allActiveSnap = await db.collection('players').doc(userId).collection('quests')
            .where('status', '==', 'active')
            .where('type', '!=', 'evolution')
            .get();

        const dailyActive = allActiveSnap.docs.filter(d => d.data().type === 'daily');
        const weeklyActive = allActiveSnap.docs.filter(d => d.data().type === 'weekly');

        // Tablon disponible (diarias)
        const dailyAvailableSnap = await db.collection('quests')
            .where('type', '==', 'daily')
            .where('min_level', '<=', player.level)
            .limit(6)
            .get();

        const availableQuests = [];
        for (const qDoc of dailyAvailableSnap.docs) {
            const qData = qDoc.data();
            // Verificar que no este activa
            const isActive = allActiveSnap.docs.some(dq => dq.data().quest_id === Number(qDoc.id));
            if (!isActive) {
                availableQuests.push({ ...qData, id: qDoc.id });
            }
        }

        const cooldown = await getGlobalCooldown(userId);

        res.json({
            status: 'ok',
            context,
            level: player.level,
            maxQuestSlots: getMaxQuestSlots(player.level),
            dailyActive: dailyActive.map(d => ({ ...d.data(), id: d.id })),
            weeklyActive: weeklyActive.map(d => ({ ...d.data(), id: d.id })),
            availableQuests,
            globalCooldown: cooldown.globalCooldown,
            lastHallActionAt: cooldown.lastHallActionAt,
        });

    } catch (err) {
        console.error('Error en getQuestStatus:', err);
        res.status(500).json({ message: 'Error obteniendo estado de misiones.' });
    }
};

exports.acceptQuest = async (req, res) => {
    const userId = req.user.id;
    const { questId } = req.body;

    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado' });
        const playerLevel = playerDoc.data().level;

        // Verificar quests activas max slots
        const activeSnap = await db.collection('players').doc(userId).collection('quests')
            .where('status', '==', 'active')
            .get();

        if (activeSnap.size >= getMaxQuestSlots(playerLevel)) {
            return res.status(400).json({ message: 'No puedes aceptar mas misiones. Usa el Salon de Valhallus para cerrar misiones.' });
        }

        // Verificar cooldown
        if (playerDoc.data().last_hall_action_at) {
            const lastAction = playerDoc.data().last_hall_action_at.toDate ? playerDoc.data().last_hall_action_at.toDate() : new Date(playerDoc.data().last_hall_action_at);
            if ((new Date() - lastAction) < 30 * 60 * 1000) {
                return res.status(429).json({ message: 'Debes esperar el cooldown antes de aceptar nueva mision.' });
            }
        }

        const questDoc = await db.collection('quests').doc(String(questId)).get();
        if (!questDoc.exists) return res.status(404).json({ message: 'Mision no encontrada.' });
        const questData = questDoc.data();

        // Verificar nivel requerido
        if (playerLevel < questData.min_level) {
            return res.status(400).json({ message: 'Nivel insuficiente. Se requiere nivel ' + questData.min_level + '.' });
        }

        // Insertar quest activa del jugador
        await db.collection('players').doc(userId).collection('quests').add({
            quest_id: Number(questId),
            title: questData.title,
            description: questData.description,
            requirements: questData.requirements || [],
            progress: {},
            type: questData.type,
            min_level: questData.min_level,
            reward_xp: questData.reward_xp,
            reward_gold: questData.reward_gold,
            reward_silver: questData.reward_silver,
            reward_copper: questData.reward_copper,
            status: 'active',
            created_at: new Date(),
        });

        // Actualizar timestamp
        await db.collection('players').doc(userId).update({ last_hall_action_at: new Date() });

        res.json({ success: true, message: 'Mision aceptada.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message || 'Error aceptando mision.' });
    }
};

exports.completeQuest = async (req, res) => {
    const userId = req.user.id;
    const { playerQuestId } = req.body;

    try {
        const pqDoc = await db.collection('players').doc(userId).collection('quests').doc(playerQuestId).get();
        if (!pqDoc.exists || pqDoc.data().player_id !== userId || pqDoc.data().status !== 'active') {
            throw new Error('Mision no valida o ya reclamada.');
        }
        const userQuest = pqDoc.data();

        // Validar progreso
        let isComplete = true;
        (userQuest.requirements || []).forEach(req => {
            const current = userQuest.progress[req.target_id || req.type] || 0;
            if (current < req.count) isComplete = false;
        });
        if (!isComplete) throw new Error('Objetivos incompletos.');

        // Datos jugador
        const playerDoc = await db.collection('players').doc(userId).get();
        let currentLevel = parseInt(playerDoc.data().level || 1);
        let currentXp = parseInt(playerDoc.data().experience || 0);
        let currentStatPoints = parseInt(playerDoc.data().stat_points || 0);

        // Economia
        const rewardTotal = ((userQuest.reward_gold || 0) * 10000) + ((userQuest.reward_silver || 0) * 100) + (userQuest.reward_copper || 0);
        const normalized = normalizeCurrency(playerDoc.data().gold, playerDoc.data().silver, playerDoc.data().copper, rewardTotal);

        // XP y Nivel
        currentXp += (userQuest.reward_xp || 0);
        while (true) {
            const needed = getRequiredXp(currentLevel);
            if (currentXp >= needed) { currentXp -= needed; currentLevel++; currentStatPoints += 5; }
            else break;
        }

        // Guardar cambios en jugador
        await db.collection('players').doc(userId).update({
            experience: currentXp, level: currentLevel, stat_points: currentStatPoints,
            gold: normalized.newGold, silver: normalized.newSilver, copper: normalized.newCopper,
        });

        // Guardar items en paquetes del jugador
        if (userQuest.reward_items) {
            for (const item of userQuest.reward_items) {
                const tplDoc = await db.collection('items_templates').doc(String(item.template_id)).get();
                if (tplDoc.exists) {
                    let finalStats = {};
                    if (tplDoc.data().type !== 'material' && tplDoc.data().type !== 'consumable') {
                        finalStats = generateQuestItemStats(tplDoc.data().base_stats);
                    }
                    await db.collection('players').doc(userId).collection('packages').add({
                        item_template_id: Number(item.template_id), quantity: item.qty, data: finalStats, created_at: new Date(),
                    });
                } else {
                    await db.collection('players').doc(userId).collection('packages').add({
                        item_template_id: Number(item.template_id), quantity: item.qty, created_at: new Date(),
                    });
                }
            }
        }

        // Cerrar mision
        await db.collection('players').doc(userId).collection('quests').doc(playerQuestId).update({
            status: 'completed', completed_at: new Date(),
        });

        // Lógica Evolucion
        let extraMsg = '';
        if (userQuest.type === 'evolution') {
            const pDataDoc = await db.collection('players').doc(userId).get();
            if (pDataDoc.data().pending_class_id) {
                const clsDoc = await db.collection('classes').doc(String(pDataDoc.data().pending_class_id)).get();
                if (clsDoc.exists) {
                    const refund = (currentLevel - 1) * 5;
                    await db.collection('players').doc(userId).update({
                        class_id: pDataDoc.data().pending_class_id, pending_class_id: null,
                        stats: clsDoc.data().base_stats || {}, stat_points: refund, evolution_quest_status: 'completed',
                    });
                    extraMsg = ' Has ascendido a ' + clsDoc.data().name + '!';
                }
            }
        }

        res.json({ success: true, message: 'Recompensa reclamada.' + extraMsg });

    } catch (err) {
        res.status(400).json({ message: err.message || 'Error completando mision.' });
    }
};
