const pool = require('../config/db');

// --- CONSTANTES ---
const MAX_REFRESHES = 6; 
const ITEMS_PER_ROTATION = 8; 

// --- HELPERS ---
const getRefreshCost = (timesUsed) => {
    if (timesUsed === 0) return 0; 
    if (timesUsed >= MAX_REFRESHES) return -1; 
    return timesUsed * 10; 
};

const normalizeCurrency = (currentGold, currentSilver, currentCopper, changeAmount) => {
    let totalCopper = (parseInt(currentGold) * 10000) + (parseInt(currentSilver) * 100) + parseInt(currentCopper) + parseInt(changeAmount);
    if (totalCopper < 0) return null; 
    
    const newGold = Math.floor(totalCopper / 10000);
    totalCopper %= 10000;
    const newSilver = Math.floor(totalCopper / 100);
    const newCopper = totalCopper % 100;

    return { gold: newGold, silver: newSilver, copper: newCopper }; // Nombres corregidos para el frontend
};

// Genera stats concretos a partir de rangos (ej: [2,5] -> 3)
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

// Función auxiliar para generar stock nuevo y guardarlo
const generateNewStock = async (client, userId) => {
    // 1. Elegir Templates aleatorios
    const randomTemplates = await client.query(`
        SELECT * FROM items_templates 
        WHERE in_shop = true 
        ORDER BY RANDOM() LIMIT $1
    `, [ITEMS_PER_ROTATION]);

    // 2. "Materializar" los ítems (Calcular sus stats ahora mismo)
    const stockItems = randomTemplates.rows.map((tpl, index) => {
        return {
            shop_id: index, // ID único temporal para esta rotación
            template_id: tpl.id,
            name: tpl.name,
            type: tpl.type,
            rarity: tpl.rarity,
            icon: tpl.icon,
            image_url: tpl.image_url,
            description: tpl.description,
            min_level: tpl.min_level,
            // Aquí la magia: Stats fijos pre-calculados
            specific_stats: generateConcreteStats(tpl.base_stats), 
            price_copper: tpl.price_copper,
            buy_price: tpl.price_copper * 5,
            stackable: tpl.stackable
        };
    });

    // 3. Guardar el objeto completo en la DB
    await client.query(
        'UPDATE players SET current_shop_stock = $1, last_shop_reset = NOW() WHERE id = $2',
        [JSON.stringify(stockItems), userId]
    );

    return stockItems;
};

// ==========================================
// 1. OBTENER TIENDA
// ==========================================
exports.getShopItems = async (req, res) => {
    const userId = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const playerRes = await client.query('SELECT shop_refreshes_used, last_shop_reset, current_shop_stock FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];
        
        let currentStock = player.current_shop_stock || [];
        
        // Reset diario
        const lastReset = new Date(player.last_shop_reset);
        const now = new Date();
        const isNewDay = lastReset.getDate() !== now.getDate() || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();

        if (isNewDay) {
            await client.query('UPDATE players SET shop_refreshes_used = 0 WHERE id = $1', [userId]);
            player.shop_refreshes_used = 0;
            currentStock = []; // Forzamos regeneración
        }

        // Si no hay stock válido, generar uno nuevo
        if (!currentStock || currentStock.length === 0) {
            currentStock = await generateNewStock(client, userId);
        }

        await client.query('COMMIT');

        res.json({ 
            success: true, 
            items: currentStock, // Enviamos los ítems ya materializados
            refreshesUsed: player.shop_refreshes_used,
            nextRefreshCost: getRefreshCost(player.shop_refreshes_used)
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error cargando tienda.' });
    } finally {
        client.release();
    }
};

// ==========================================
// 2. REFRESCAR TIENDA (Gacha)
// ==========================================
exports.refreshShop = async (req, res) => {
    const userId = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const playerRes = await client.query('SELECT onix, shop_refreshes_used FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];
        const cost = getRefreshCost(player.shop_refreshes_used);

        if (cost === -1) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Límite diario alcanzado.' }); }
        if (player.onix < cost) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'No tienes suficiente Ónix.' }); }

        if (cost > 0) {
            await client.query('UPDATE players SET onix = onix - $1 WHERE id = $2', [cost, userId]);
        }

        await client.query('UPDATE players SET shop_refreshes_used = shop_refreshes_used + 1 WHERE id = $1', [userId]);

        // Generar nuevo stock
        const newStock = await generateNewStock(client, userId);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: '¡Tienda refrescada!',
            items: newStock,
            refreshesUsed: player.shop_refreshes_used + 1,
            nextRefreshCost: getRefreshCost(player.shop_refreshes_used + 1),
            newOnix: player.onix - cost
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error al refrescar.' });
    } finally {
        client.release();
    }
};

// ==========================================
// 3. COMPRAR ÍTEM (Usa stats pre-calculados)
// ==========================================
exports.buyItem = async (req, res) => {
    const userId = req.user.id;
    const { shopId, quantity } = req.body; // Ahora usamos shopId (índice)
    const qty = quantity || 1;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const playerCheck = await client.query('SELECT current_shop_stock, gold, silver, copper FROM players WHERE id = $1', [userId]);
        const currentStock = playerCheck.rows[0].current_shop_stock || [];
        const player = playerCheck.rows[0];

        // Buscar el ítem en la memoria del jugador
        const targetItem = currentStock.find(i => i.shop_id === parseInt(shopId));

        if (!targetItem) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Este ítem ya no existe (Refresca).' });
        }

        const totalCost = targetItem.buy_price * qty;
        const newBalance = normalizeCurrency(player.gold, player.silver, player.copper, -totalCost);
        
        if (!newBalance) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Dinero insuficiente.' }); }

        // Actualizar dinero
        await client.query('UPDATE players SET gold = $1, silver = $2, copper = $3 WHERE id = $4', [newBalance.gold, newBalance.silver, newBalance.copper, userId]);

        // Entregar el ítem con los 'specific_stats' que vio el usuario
        let itemAdded = false;
        if (targetItem.stackable) {
            const existingRes = await client.query('SELECT id FROM player_items WHERE player_id = $1 AND template_id = $2 AND is_equipped = false LIMIT 1', [userId, targetItem.template_id]);
            if (existingRes.rows.length > 0) {
                await client.query('UPDATE player_items SET quantity = quantity + $1 WHERE id = $2', [qty, existingRes.rows[0].id]);
                itemAdded = true;
            }
        }

        if (!itemAdded) {
            const slotsRes = await client.query('SELECT bag_slot FROM player_items WHERE player_id = $1 AND bag_slot IS NOT NULL', [userId]);
            const occupiedSlots = new Set(slotsRes.rows.map(r => r.bag_slot));
            let targetSlot = -1;
            for (let i = 0; i < 200; i++) { if (!occupiedSlots.has(i)) { targetSlot = i; break; } }
            if (targetSlot === -1) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Inventario lleno.' }); }

            await client.query(`
                INSERT INTO player_items (player_id, template_id, bag_slot, quantity, base_stats, is_equipped, durability_current, durability_max, is_bound) 
                VALUES ($1, $2, $3, $4, $5, false, 100, 100, false)
            `, [userId, targetItem.template_id, targetSlot, qty, targetItem.specific_stats]);
        }

        await client.query('COMMIT');
        
        const invRes = await client.query(`SELECT pi.*, it.name, it.image_url, it.rarity, it.type, it.price_copper, it.stackable FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1 ORDER BY pi.bag_slot ASC`, [userId]);

        res.json({ success: true, message: `Compraste ${qty}x ${targetItem.name}`, inventory: invRes.rows, newMoney: newBalance });

    } catch (err) { await client.query('ROLLBACK'); console.error(err); res.status(500).json({ message: err.message }); } finally { client.release(); }
};

// ==========================================
// 4. VENDER ÍTEM (Arreglado retorno de dinero)
// ==========================================
exports.sellItem = async (req, res) => {
    const userId = req.user.id;
    const { itemId, quantity } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const itemRes = await client.query(`SELECT pi.*, it.name, it.price_copper FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.id = $1 AND pi.player_id = $2`, [itemId, userId]);
        if (itemRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Ítem no encontrado.' }); }
        const item = itemRes.rows[0];
        if (item.price_copper <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'No tiene valor.' }); }

        let qtyToSell = quantity || item.quantity;
        if (qtyToSell > item.quantity) qtyToSell = item.quantity;
        const totalValue = item.price_copper * qtyToSell;

        if (qtyToSell >= item.quantity) { await client.query('DELETE FROM player_items WHERE id = $1', [itemId]); } 
        else { await client.query('UPDATE player_items SET quantity = quantity - $1 WHERE id = $2', [qtyToSell, itemId]); }

        const playerRes = await client.query('SELECT gold, silver, copper FROM players WHERE id = $1', [userId]);
        const newMoney = normalizeCurrency(playerRes.rows[0].gold, playerRes.rows[0].silver, playerRes.rows[0].copper, totalValue);
        await client.query('UPDATE players SET gold = $1, silver = $2, copper = $3 WHERE id = $4', [newMoney.gold, newMoney.silver, newMoney.copper, userId]);
        
        await client.query('COMMIT');
        const invRes = await client.query(`SELECT pi.*, it.name, it.image_url, it.rarity, it.type, it.price_copper, it.stackable FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1 ORDER BY pi.bag_slot ASC`, [userId]);
        res.json({ success: true, message: `Vendiste ${qtyToSell}x ${item.name}`, inventory: invRes.rows, newMoney });
    } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Error venta' }); } finally { client.release(); }
};