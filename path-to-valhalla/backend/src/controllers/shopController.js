const pool = require('../config/db');

// --- HELPER: Normalizar Moneda ---
const normalizeCurrency = (currentGold, currentSilver, currentCopper, changeAmount) => {
    // changeAmount puede ser negativo (gastar) o positivo (ganar)
    let totalCopper = (parseInt(currentGold) * 10000) + (parseInt(currentSilver) * 100) + parseInt(currentCopper) + parseInt(changeAmount);
    
    if (totalCopper < 0) return null; // No alcanza el dinero

    const newGold = Math.floor(totalCopper / 10000);
    totalCopper %= 10000;
    
    const newSilver = Math.floor(totalCopper / 100);
    const newCopper = totalCopper % 100;

    return { newGold, newSilver, newCopper };
};

// --- HELPER: Generar Stats RNG (Para cuando compras equipo) ---
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

// ==========================================
// 1. OBTENER STOCK DE LA TIENDA
// ==========================================
exports.getShopItems = async (req, res) => {
    try {
        // Traemos todos los items que tengan precio definido y sean de nivel bajo/medio para empezar
        // Multiplicamos el precio por 5 para que comprar sea más caro que vender (economía básica)
        const itemsRes = await pool.query(`
            SELECT id, name, type, rarity, icon, image_url, description, 
                   min_level, base_stats, (price_copper * 5) as buy_price 
            FROM items_templates 
            WHERE price_copper > 0 
            ORDER BY min_level ASC, type ASC
        `);

        res.json({ success: true, items: itemsRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error cargando la tienda.' });
    }
};

// ==========================================
// 2. COMPRAR ÍTEM
// ==========================================
exports.buyItem = async (req, res) => {
    const userId = req.user.id;
    const { templateId, quantity } = req.body;
    const qty = quantity || 1;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // A. Obtener datos del Item y Precio
        const tplRes = await client.query('SELECT * FROM items_templates WHERE id = $1', [templateId]);
        if (tplRes.rows.length === 0) throw new Error("Ítem no existe.");
        const template = tplRes.rows[0];

        const unitPrice = template.price_copper * 5; // Margen de ganancia del NPC
        const totalCost = unitPrice * qty;

        // B. Cobrar al Jugador
        const playerRes = await client.query('SELECT gold, silver, copper FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        const newBalance = normalizeCurrency(player.gold, player.silver, player.copper, -totalCost);
        
        if (!newBalance) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No tienes suficiente dinero.' });
        }

        await client.query(
            'UPDATE players SET gold = $1, silver = $2, copper = $3 WHERE id = $4',
            [newBalance.newGold, newBalance.newSilver, newBalance.newCopper, userId]
        );

        // C. Entregar el Ítem (Lógica de Stacking o Nuevo Slot)
        let dropStats = {};
        if (template.type !== 'material' && template.type !== 'consumable') {
            dropStats = generateRandomStats(template.base_stats);
        }

        // 1. Intentar stackear si es posible
        let itemAdded = false;
        if (template.stackable) {
            const existingRes = await client.query(
                'SELECT id FROM player_items WHERE player_id = $1 AND template_id = $2 AND is_equipped = false LIMIT 1',
                [userId, templateId]
            );
            if (existingRes.rows.length > 0) {
                await client.query('UPDATE player_items SET quantity = quantity + $1 WHERE id = $2', [qty, existingRes.rows[0].id]);
                itemAdded = true;
            }
        }

        // 2. Si no se stackeó, buscar hueco libre
        if (!itemAdded) {
            const slotsRes = await client.query('SELECT bag_slot FROM player_items WHERE player_id = $1 AND bag_slot IS NOT NULL', [userId]);
            const occupiedSlots = new Set(slotsRes.rows.map(r => r.bag_slot));
            let targetSlot = -1;
            for (let i = 0; i < 200; i++) {
                if (!occupiedSlots.has(i)) { targetSlot = i; break; }
            }

            if (targetSlot === -1) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Inventario lleno.' });
            }

            await client.query(`
                INSERT INTO player_items (player_id, template_id, bag_slot, quantity, base_stats, is_equipped, durability_current, durability_max, is_bound)
                VALUES ($1, $2, $3, $4, $5, false, 100, 100, false)
            `, [userId, templateId, targetSlot, qty, dropStats]);
        }

        await client.query('COMMIT');

        // D. Respuesta Final
        const invRes = await client.query(`
            SELECT pi.*, it.name, it.image_url, it.rarity, it.type, it.price_copper, it.stackable 
            FROM player_items pi JOIN items_templates it ON pi.template_id = it.id 
            WHERE pi.player_id = $1 ORDER BY pi.bag_slot ASC
        `, [userId]);

        res.json({
            success: true,
            message: `Compraste ${qty}x ${template.name}`,
            inventory: invRes.rows,
            newMoney: newBalance
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message || 'Error en la compra.' });
    } finally {
        client.release();
    }
};

// ==========================================
// 3. VENDER ÍTEM (Tu código original + correcciones menores)
// ==========================================
exports.sellItem = async (req, res) => {
    const userId = req.user.id;
    const { itemId, quantity } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const itemRes = await client.query(`
            SELECT pi.*, it.name, it.price_copper FROM player_items pi
            JOIN items_templates it ON pi.template_id = it.id
            WHERE pi.id = $1 AND pi.player_id = $2
        `, [itemId, userId]);

        if (itemRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Ítem no encontrado.' }); }
        const item = itemRes.rows[0];

        if (item.price_copper <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'No tiene valor.' }); }

        let qtyToSell = quantity || item.quantity;
        if (qtyToSell > item.quantity) qtyToSell = item.quantity;

        const totalValue = item.price_copper * qtyToSell;

        if (qtyToSell >= item.quantity) {
            await client.query('DELETE FROM player_items WHERE id = $1', [itemId]);
        } else {
            await client.query('UPDATE player_items SET quantity = quantity - $1 WHERE id = $2', [qtyToSell, itemId]);
        }

        const playerRes = await client.query('SELECT gold, silver, copper FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];
        const newMoney = normalizeCurrency(player.gold, player.silver, player.copper, totalValue);

        await client.query('UPDATE players SET gold = $1, silver = $2, copper = $3 WHERE id = $4', [newMoney.newGold, newMoney.newSilver, newMoney.newCopper, userId]);
        await client.query('COMMIT');

        const invRes = await client.query(`SELECT pi.*, it.name, it.image_url, it.rarity, it.type, it.price_copper, it.stackable FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1 ORDER BY pi.bag_slot ASC`, [userId]);

        res.json({ success: true, message: `Vendiste ${qtyToSell}x ${item.name}`, inventory: invRes.rows, newMoney });

    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Error venta' }); } finally { client.release(); }
};