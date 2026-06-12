const { db } = require('../config/db');
const { hydratePlayer } = require('../shared/player_stats');

// ==========================================
// 1. HELPER: GENERAR STATS
// ==========================================
const generateRandomStats = (templateStats) => {
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

exports.adminGiveItem = async (req, res) => {
    const { userId, templateId } = req.body;
    try {
        const templateDoc = await db.collection('items_templates').doc(String(templateId)).get();
        if (!templateDoc.exists) return res.status(404).json({ message: 'Template no existe.' });
        const template = templateDoc.data();
        const uniqueStats = generateRandomStats(template.base_stats);

        let durCur = 100, durMax = 100;
        if (['consumable', 'material', 'scroll', 'recipe'].includes(template.type) || template.rarity === 'legendary') {
            durCur = null; durMax = null;
        }

        const slotsSnap = await db.collection('players').doc(userId).collection('items')
            .where('bag_slot', '!=', null)
            .get();
        const occupiedSlots = new Set(slotsSnap.docs.map(d => d.data().bag_slot));
        let targetSlot = -1;
        for (let i = 0; i < 40; i++) { if (!occupiedSlots.has(i)) { targetSlot = i; break; } }
        if (targetSlot === -1) return res.status(400).json({ message: 'Inventario lleno.' });

        await db.collection('players').doc(userId).collection('items').add({
            template_id: Number(templateId),
            is_equipped: false,
            bag_slot: targetSlot,
            base_stats: uniqueStats,
            durability_current: durCur,
            durability_max: durMax,
            is_bound: false,
            quantity: 1,
            created_at: new Date(),
        });

        res.json({ success: true, message: 'Recibido: ' + template.name, stats: uniqueStats });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error server' });
    }
};

exports.moveItem = async (req, res) => {
    const { itemId, destination } = req.body; // userId se obtiene del token
    const userId = req.user.id;

    try {
        const itemRef = db.collection('players').doc(userId).collection('items').doc(itemId);
        const itemDoc = await itemRef.get();
        if (!itemDoc.exists) return res.status(404).json({ message: 'Item no encontrado.' });
        const sourceItem = { ...itemDoc.data(), id: itemId };

        const tplDoc = await db.collection('items_templates').doc(String(sourceItem.template_id)).get();
        if (!tplDoc.exists) throw new Error('Template not found');
        const itemTpl = tplDoc.data();

        const playerDoc = await db.collection('players').doc(userId).get();
        const playerLevel = playerDoc.data().level;

        if (destination.type === 'equipped') {
            if (playerLevel < 100) {
                const maxAllowedLevel = playerLevel + 9;
                if (itemTpl.min_level > maxAllowedLevel) {
                    return res.status(400).json({ message: 'Nivel insuficiente (Req: ' + itemTpl.min_level + ').' });
                }
            }

            // Desequipar si habia algo equipado en ese slot
            const existingSnap = await db.collection('players').doc(userId).collection('items')
                .where('is_equipped', '==', true)
                .where('equipped_slot', '==', destination.slot)
                .get();

            if (!existingSnap.empty) {
                const oldItem = existingSnap.docs[0];
                await db.collection('players').doc(userId).collection('items').doc(oldItem.id).update({
                    is_equipped: false,
                    equipped_slot: null,
                    bag_slot: sourceItem.bag_slot,
                });
            }

            await itemRef.update({
                is_equipped: true,
                equipped_slot: destination.slot,
                bag_slot: null,
                is_bound: true,
            });
        } else if (destination.type === 'bag') {
            const targetBagSlot = destination.slot;
            const targetSnap = await db.collection('players').doc(userId).collection('items')
                .where('is_equipped', '==', false)
                .where('bag_slot', '==', targetBagSlot)
                .get();

            if (!targetSnap.empty) {
                const targetItem = targetSnap.docs[0];
                // Si es stackable y mismo template, sumar cantidad
                if (itemTpl.stackable && sourceItem.quantity > 1 && sourceItem.template_id === targetItem.data().template_id) {
                    await db.collection('players').doc(userId).collection('items').doc(targetItem.id).update({
                        quantity: (targetItem.data().quantity || 1) + (sourceItem.quantity || 1),
                    });
                    await itemRef.delete();
                } else {
                    // Intercambiar slots
                    const swapTargetSnap = await db.collection('players').doc(userId).collection('items')
                        .where('is_equipped', '==', false)
                        .where('bag_slot', '==', sourceItem.bag_slot)
                        .get();

                    if (!swapTargetSnap.empty) {
                        const swapTarget = swapTargetSnap.docs[0];
                        await db.collection('players').doc(userId).collection('items').doc(swapTarget.id).update({ bag_slot: targetBagSlot });
                    }

                    await itemRef.update({
                        is_equipped: false,
                        equipped_slot: null,
                        bag_slot: targetBagSlot,
                    });
                }
            } else {
                await itemRef.update({ bag_slot: targetBagSlot });
            }
        }

        // Retornar inventario actualizado
        const invSnap = await db.collection('players').doc(userId).collection('items').orderBy('bag_slot', 'asc').get();
        const inventoryItems = [];
        for (const itemDoc of invSnap.docs) {
            const data = itemDoc.data();
            const tplDc = await db.collection('items_templates').doc(String(data.template_id)).get();
            if (tplDc.exists) {
                inventoryItems.push({ ...data, id: itemDoc.id, name: tplDc.data().name, type: tplDc.data().type, slot: tplDc.data().slot, rarity: tplDc.data().rarity, icon: tplDc.data().icon, image_url: tplDc.data().image_url });
            }
        }

        res.json({ success: true, message: 'Movimiento completado.', inventory: inventoryItems });

    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
};

exports.organizeInventory = async (req, res) => {
    const userId = req.user.id;
    try {
        const itemsSnap = await db.collection('players').doc(userId).collection('items')
            .where('is_equipped', '==', false)
            .orderBy('bag_slot', 'asc')
            .get();

        // Separar equipados de desequipados
        const unequippedSnap = await db.collection('players').doc(userId).collection('items')
            .where('is_equipped', '==', false)
            .orderBy('bag_slot', 'asc')
            .get();

        let nextSlot = 0;
        for (const itemDoc of unequippedSnap.docs) {
            const data = itemDoc.data();
            if (data.bag_slot !== nextSlot) {
                await db.collection('players').doc(userId).collection('items').doc(itemDoc.id).update({ bag_slot: nextSlot });
            }
            nextSlot++;
        }

        res.json({ success: true, message: 'Inventario organizado.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al organizar.' });
    }
};

exports.useItem = async (req, res) => {
    const userId = req.user.id;
    const { itemId, type } = req.body;

    try {
        const itemRef = db.collection('players').doc(userId).collection('items').doc(itemId);
        const itemDoc = await itemRef.get();
        if (!itemDoc.exists) return res.status(404).json({ message: 'Item no encontrado.' });
        const inventoryItemId = itemDoc.id;

        let shouldConsume = false;
        let msg = '';

        const tplSnap = await db.collection('items_templates').doc(String(itemDoc.data().template_id)).get();
        if (!tplSnap.exists) throw new Error('Template not found');
        const item = { ...itemDoc.data(), ...tplSnap.data() };

        if (type === 'use') {
            // Pociones
            if (item.type === 'consumable') {
                const stats = item.base_stats || {};
                if (stats.heal_amount) {
                    const heal = parseInt(stats.heal_amount);
                    await db.collection('players').doc(userId).update({ current_hp: Math.min(1000, (itemDoc.data().current_hp || 0) + heal) });
                    msg = 'Te curaste ' + heal + ' HP.';
                    shouldConsume = true;
                }
            }
            // Recetas
            else if (item.type === 'recipe') {
                const recipeId = item.stats?.learn_recipe_id;
                if (!recipeId) throw new Error('Este plano es ilegible.');
                await db.collection('players').doc(userId).collection('recipes').doc(String(recipeId)).set({ learned_at: new Date() }, { merge: true });
                msg = 'Nueva receta aprendida!';
                shouldConsume = true;
            }
            // Grimorios (Skills)
            else if (item.type === 'scroll') {
                const skillId = item.stats?.learn_skill_id;
                if (!skillId) throw new Error('El pergamino esta vacio.');
                const hasSkillSnap = await db.collection('players').doc(userId).collection('skills')
                    .where('skill_id', '==', Number(skillId))
                    .limit(1)
                    .get();
                if (!hasSkillSnap.empty) throw new Error('Ya conoces esta habilidad.');
                await db.collection('players').doc(userId).collection('skills').add({
                    skill_id: Number(skillId), is_equipped: false, skill_level: 1, slot_index: 0, created_at: new Date(),
                });
                msg = 'Habilidad aprendida!';
                shouldConsume = true;
            }
            // Equipamiento
            else if (['weapon', 'armor', 'accessory'].includes(item.type)) {
                const playerDoc = await db.collection('players').doc(userId).get();
                const playerLevel = playerDoc.data().level;
                if (playerLevel < 100) {
                    const maxAllowed = playerLevel + 9;
                    if (item.min_level > maxAllowed) throw new Error('Nivel insuficiente (' + item.min_level + ').');
                }

                let targetSlot = item.slot;
                if (item.slot === 'ring') targetSlot = 'ring_1';
                if (item.slot === 'earring') targetSlot = 'earring_1';
                if (!targetSlot) throw new Error('Este objeto no se puede equipar.');

                const existingSnap = await db.collection('players').doc(userId).collection('items')
                    .where('is_equipped', '==', true)
                    .where('equipped_slot', '==', targetSlot)
                    .get();

                if (!existingSnap.empty) {
                    const oldItem = existingSnap.docs[0];
                    await db.collection('players').doc(userId).collection('items').doc(oldItem.id).update({
                        is_equipped: false, equipped_slot: null, bag_slot: itemDoc.data().bag_slot,
                    });
                }

                await itemRef.update({ is_equipped: true, equipped_slot: targetSlot, bag_slot: null, is_bound: true });
                msg = 'Equipado: ' + item.name;
                shouldConsume = false;
            }
        } else {
            throw new Error('No puedes usar este objeto aqui.');
        }

        // Consumir si aplica
        if (shouldConsume) {
            const currentQty = itemDoc.data().quantity || 1;
            if (currentQty > 1) {
                await itemRef.update({ quantity: currentQty - 1 });
            } else {
                await itemRef.delete();
            }
        }

        res.json({ success: true, message: msg });

    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
};
