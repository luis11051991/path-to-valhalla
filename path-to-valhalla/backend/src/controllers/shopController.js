const { db } = require('../config/db');

const MAX_REFRESHES = 6;
const ITEMS_PER_ROTATION = 20;

const getRefreshCost = (timesUsed) => {
    if (timesUsed === 0) return 0;
    if (timesUsed >= MAX_REFRESHES) return -1;
    return timesUsed * 10;
};

const generateConcreteStats = (templateStats) => {
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

const generateNewStock = async (userId) => {
    const randomTemplatesSnap = await db.collection('items_templates')
        .where('in_shop', '==', true)
        .limit(ITEMS_PER_ROTATION)
        .get();

    // Firestore no tiene ORDER BY RANDOM(), asi que traemos todos y ordenamos en memoria
    const allShopSnap = await db.collection('items_templates').where('in_shop', '==', true).get();
    const allTemplates = allShopSnap.docs.map(d => d.data());
    
    // Shuffle en memoria
    for (let i = allTemplates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTemplates[i], allTemplates[j]] = [allTemplates[j], allTemplates[i]];
    }

    const stockItems = allTemplates.slice(0, ITEMS_PER_ROTATION).map((tpl, index) => ({
        shop_id: index, template_id: Number(tpl.id), name: tpl.name, type: tpl.type, rarity: tpl.rarity,
        icon: tpl.icon, image_url: tpl.image_url, description: tpl.description, min_level: tpl.min_level,
        specific_stats: generateConcreteStats(tpl.base_stats), price_copper: tpl.price_copper,
        buy_price: tpl.price_copper * 5, stackable: tpl.stackable || false,
    }));

    // Guardar stock como array en el jugador
    await db.collection('players').doc(userId).set({
        current_shop_stock: stockItems, last_shop_reset: new Date(), shop_refreshes_used: 0,
    }, { merge: true });

    return stockItems;
};

exports.getShopItems = async (req, res) => {
    const userId = req.user.id;

    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado.' });
        
        let currentStock = playerDoc.data().current_shop_stock || [];
        const playerShopRefreshesUsed = playerDoc.data().shop_refreshes_used || 0;

        // Verificar si es nuevo dia
        const lastReset = playerDoc.data().last_shop_reset;
        if (lastReset) {
            const lastResetDate = lastReset.toDate ? lastReset.toDate() : new Date(lastReset);
            const now = new Date();
            const isNewDay = lastResetDate.getDate() !== now.getDate() || lastResetDate.getMonth() !== now.getMonth();

            if (isNewDay) {
                await db.collection('players').doc(userId).update({ shop_refreshes_used: 0, current_shop_stock: [] });
                currentStock = [];
            }
        }

        if (!currentStock || currentStock.length === 0) {
            currentStock = await generateNewStock(userId);
        }

        res.json({ 
            success: true, items: currentStock, refreshesUsed: playerShopRefreshesUsed,
            nextRefreshCost: getRefreshCost(playerShopRefreshesUsed),
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error cargando tienda.' });
    }
};

exports.refreshShop = async (req, res) => {
    const userId = req.user.id;

    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado.' });
        
        const cost = getRefreshCost(playerDoc.data().shop_refreshes_used || 0);
        if (cost === -1) return res.status(400).json({ message: 'Limite diario alcanzado.' });
        if ((playerDoc.data().onix || 0) < cost) return res.status(400).json({ message: 'No tienes suficiente Onix.' });

        await db.runTransaction(async (t) => {
            const playerRef = db.collection('players').doc(userId);
            const updatedRefreshes = (playerDoc.data().shop_refreshes_used || 0) + 1;

            if (cost > 0) {
                t.update(playerRef, { onix: (playerDoc.data().onix || 0) - cost });
            }
            t.update(playerRef, { shop_refreshes_used: updatedRefreshes });
        });

        const newStock = await generateNewStock(userId);

        res.json({ success: true, items: newStock, refreshesUsed: (playerDoc.data().shop_refreshes_used || 0) + 1, nextRefreshCost: getRefreshCost((playerDoc.data().shop_refreshes_used || 0) + 1) });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error refrescando tienda.' });
    }
};

exports.buyItem = async (req, res) => {
    const userId = req.user.id;
    const { itemId, quantity } = req.body; // itemId es el shop_id del stock actual

    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado.' });
        
        let currentStock = playerDoc.data().current_shop_stock || [];
        const targetItemIndex = Number(itemId);
        
        if (targetItemIndex >= currentStock.length) throw new Error('Item no esta en el stock.');
        const targetItem = currentStock[targetItemIndex];
        
        if (!targetItem) throw new Error('Item no encontrado.');

        const qty = quantity || 1;
        const totalCost = targetItem.buy_price * qty;

        // Verificar fondos suficientes (gold/silver/copper)
        const walletCopper = (parseInt(playerDoc.data().gold || 0) * 10000) + (parseInt(playerDoc.data().silver || 0) * 100) + parseInt(playerDoc.data().copper);
        if (walletCopper < totalCost) throw new Error('Fondos insuficientes.');

        await db.runTransaction(async (t) => {
            const playerRef = db.collection('players').doc(userId);
            
            // Pagar
            t.update(playerRef, {
                copper: walletCopper - totalCost >= 0 ? (walletCopper - totalCost) : 0,
            });

            // Insertar en inventario del jugador
            await t.create(db.collection('players').doc(userId).collection('items'), {
                template_id: targetItem.template_id, bag_slot: null, quantity: qty,
                base_stats: targetItem.specific_stats || {}, is_equipped: false,
                durability_current: 100, durability_max: 100, is_bound: false, created_at: new Date(),
            });
        });

        // Actualizar stock local
        const playerDoc2 = await db.collection('players').doc(userId).get();
        currentStock = playerDoc2.data().current_shop_stock || [];
        currentStock.splice(targetItemIndex, 1);
        await db.collection('players').doc(userId).update({ current_shop_stock: currentStock });

        const invSnap = await db.collection('players').doc(userId).collection('items').orderBy('bag_slot', 'asc').get();
        const inventoryItems = [];
        for (const itemDoc of invSnap.docs) {
            const data = itemDoc.data();
            const tplDoc = await db.collection('items_templates').doc(String(data.template_id)).get();
            if (tplDoc.exists) inventoryItems.push({ ...data, id: itemDoc.id, name: tplDoc.data().name });
        }

        res.json({ success: true, message: 'Compraste ' + qty + 'x ' + targetItem.name, inventory: inventoryItems, updatedStock: currentStock });

    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
};

exports.sellItem = async (req, res) => {
    const userId = req.user.id;
    const { itemId, quantity } = req.body;

    try {
        const itemRef = db.collection('players').doc(userId).collection('items').doc(itemId);
        const itemDoc = await itemRef.get();
        if (!itemDoc.exists) return res.status(404).json({ message: 'Item no encontrado.' });
        
        const itemData = itemDoc.data();
        const tplDoc = await db.collection('items_templates').doc(String(itemData.template_id)).get();
        if (!tplDoc.exists || tplDoc.data().price_copper <= 0) return res.status(400).json({ message: 'No tiene valor.' });

        let qtyToSell = quantity || itemData.quantity;
        if (qtyToSell > itemData.quantity) qtyToSell = itemData.quantity;
        const totalValue = tplDoc.data().price_copper * qtyToSell;

        // Eliminar item o reducir cantidad
        if (qtyToSell >= itemData.quantity) {
            await itemRef.delete();
        } else {
            await itemRef.update({ quantity: itemData.quantity - qtyToSell });
        }

        // Agregar al wallet
        const playerDoc = await db.collection('players').doc(userId).get();
        const newTotalCopper = (playerDoc.data().gold || 0) * 10000 + (playerDoc.data().silver || 0) * 100 + (playerDoc.data().copper || 0) + totalValue;

        await db.collection('players').doc(userId).update({
            gold: Math.floor(newTotalCopper / 10000),
            silver: Math.floor((newTotalCopper % 10000) / 100),
            copper: newTotalCopper % 100,
        });

        const invSnap = await db.collection('players').doc(userId).collection('items').orderBy('bag_slot', 'asc').get();
        const inventoryItems = [];
        for (const itemDoc of invSnap.docs) {
            const data = itemDoc.data();
            const tplDc = await db.collection('items_templates').doc(String(data.template_id)).get();
            if (tplDc.exists) inventoryItems.push({ ...data, id: itemDoc.id, name: tplDc.data().name });
        }

        res.json({ success: true, message: 'Vendiste ' + qtyToSell + 'x', inventory: inventoryItems });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};
