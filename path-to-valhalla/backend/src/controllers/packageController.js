const { db } = require('../config/db');

exports.getMyPackages = async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    try {
        const countSnap = await db.collection('players').doc(userId).collection('packages')
            .count()
            .get();
        const totalItems = countSnap.data().count;
        const totalPages = Math.ceil(totalItems / limit);

        const startAfter = page > 1 ? (await db.collection('players').doc(userId).collection('packages')
            .orderBy('created_at', 'desc')
            .limit(1)
            .offset((page - 1) * limit)
            .get()).docs[(page - 1) * limit - 1] : null;

        let query = db.collection('players').doc(userId).collection('packages').orderBy('created_at', 'desc').limit(limit);
        
        const packagesSnap = await query.get();
        const packages = packagesSnap.docs.map(d => ({ ...d.data(), id: d.id }));

        res.json({
            success: true,
            packages,
            pagination: { page, totalPages, totalItems },
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener paquetes.' });
    }
};

exports.claimPackage = async (req, res) => {
    const userId = req.user.id;
    const { packageId, targetSlot } = req.body; 

    try {
        const pkgRef = db.collection('players').doc(userId).collection('packages').doc(packageId);
        const pkgDoc = await pkgRef.get();
        
        if (!pkgDoc.exists) return res.status(404).json({ message: 'Paquete no encontrado.' });
        const pkg = { ...pkgDoc.data(), id: packageId };

        // Obtener template
        const tplDoc = await db.collection('items_templates').doc(String(pkg.item_template_id)).get();
        if (!tplDoc.exists) throw new Error('Template not found');
        const itemTpl = tplDoc.data();

        // Stats finales del item
        let finalItemStats = pkg.data || {};
        if (!finalItemStats || Object.keys(finalItemStats).length === 0) {
            finalItemStats = itemTpl.base_stats || {};
        }

        let itemToUpdateId = null;
        let finalSlotToInsert = -1;

        // Stacking (Solo si es stackable)
        if (itemTpl.stackable && pkg.quantity > 1) {
            const existingSnap = await db.collection('players').doc(userId).collection('items')
                .where('is_equipped', '==', false)
                .where('template_id', '==', pkg.item_template_id)
                .limit(1)
                .get();

            if (!existingSnap.empty) {
                itemToUpdateId = existingSnap.docs[0].id;
            }
        }

        // Buscar slot vacio
        if (!itemToUpdateId) {
            if (targetSlot !== undefined && targetSlot !== null) {
                const slotCheck = await db.collection('players').doc(userId).collection('items')
                    .where('bag_slot', '==', targetSlot)
                    .get();
                if (slotCheck.empty) {
                    finalSlotToInsert = targetSlot;
                }
            }

            if (finalSlotToInsert === -1) {
                const slotsSnap = await db.collection('players').doc(userId).collection('items')
                    .where('bag_slot', '!=', null)
                    .get();
                const occupiedSlots = new Set(slotsSnap.docs.map(d => d.data().bag_slot));
                
                for (let i = 0; i < 40; i++) {
                    if (!occupiedSlots.has(i)) { finalSlotToInsert = i; break; }
                }
            }

            if (finalSlotToInsert === -1) return res.status(400).json({ message: 'Inventario lleno.' });
        }

        // Ejecucion
        if (itemToUpdateId) {
            await db.collection('players').doc(userId).collection('items').doc(itemToUpdateId).update({
                quantity: (pkg.quantity || 1),
            });
        } else {
            await db.collection('players').doc(userId).collection('items').add({
                template_id: pkg.item_template_id,
                bag_slot: finalSlotToInsert,
                quantity: pkg.quantity,
                base_stats: finalItemStats,
                is_equipped: false,
                durability_current: 100,
                durability_max: 100,
                is_bound: false,
            });
        }

        // Eliminar paquete
        await pkgRef.delete();

        // Retornar inventario actualizado
        const invSnap = await db.collection('players').doc(userId).collection('items').orderBy('bag_slot', 'asc').get();
        const inventoryItems = [];
        for (const itemDoc of invSnap.docs) {
            const data = itemDoc.data();
            const tDoc = await db.collection('items_templates').doc(String(data.template_id)).get();
            if (tDoc.exists) {
                inventoryItems.push({ ...data, id: itemDoc.id, name: tDoc.data().name, type: tDoc.data().type, slot: tDoc.data().slot, rarity: tDoc.data().rarity, icon: tDoc.data().icon, image_url: tDoc.data().image_url });
            }
        }

        res.json({ success: true, inventory: inventoryItems, message: 'Recibido: ' + itemTpl.name });

    } catch (err) {
        console.error('Error claimPackage:', err);
        res.status(500).json({ message: 'Error interno.' });
    }
};
