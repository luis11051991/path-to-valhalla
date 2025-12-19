const pool = require('../config/db');

// ==========================================
// 1. HELPER: GENERAR STATS ALEATORIOS
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

// ==========================================
// 2. ADMIN: DAR ÍTEM (Generador RNG)
// ==========================================
exports.adminGiveItem = async (req, res) => {
    const { userId, templateId } = req.body;

    try {
        // A. Obtener la plantilla
        const templateRes = await pool.query('SELECT * FROM items_templates WHERE id = $1', [templateId]);
        
        if (templateRes.rows.length === 0) {
            return res.status(404).json({ message: 'Ese ID de template no existe.' });
        }
        const template = templateRes.rows[0];

        // B. Calcular Stats únicos (RNG)
        const uniqueStats = generateRandomStats(template.base_stats);

        // C. Buscar hueco vacío en mochila (0-39)
        const slotsRes = await pool.query('SELECT bag_slot FROM player_items WHERE player_id = $1 AND bag_slot IS NOT NULL', [userId]);
        const occupiedSlots = slotsRes.rows.map(row => row.bag_slot);
        
        let targetSlot = -1;
        for (let i = 0; i < 40; i++) {
            if (!occupiedSlots.includes(i)) {
                targetSlot = i;
                break;
            }
        }

        if (targetSlot === -1) {
            return res.status(400).json({ message: '¡Inventario lleno!' });
        }

        // D. Crear el objeto en la base de datos
        await pool.query(
            `INSERT INTO player_items 
            (player_id, template_id, is_equipped, bag_slot, base_stats, durability_current, durability_max, is_bound, quantity) 
            VALUES ($1, $2, false, $3, $4, 100, 100, false, 1)`,
            [userId, templateId, targetSlot, uniqueStats]
        );

        res.json({ 
            success: true, 
            message: `¡Has recibido: ${template.name}!`,
            stats: uniqueStats 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al generar ítem' });
    }
};

// ==========================================
// 3. MOVER ÍTEM (CON STACKING + SWAP)
// ==========================================
exports.moveItem = async (req, res) => {
  const { userId, itemId, destination } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener ítem origen
    const itemQuery = `
        SELECT pi.*, it.slot as valid_slot_type, it.name, it.stackable, it.type as item_type
        FROM player_items pi 
        JOIN items_templates it ON pi.template_id = it.id 
        WHERE pi.id = $1 AND pi.player_id = $2
    `;
    const itemRes = await client.query(itemQuery, [itemId, userId]);

    if (itemRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Ítem no encontrado.' });
    }

    const sourceItem = itemRes.rows[0];

    // --- CASO A: EQUIPAR (Mochila -> Personaje) ---
    if (destination.type === 'equipped') {
        let isCompatible = false;
        
        // Validaciones de slot
        if (sourceItem.valid_slot_type === destination.slot) isCompatible = true;
        else if (sourceItem.valid_slot_type === 'ring' && (destination.slot === 'ring_1' || destination.slot === 'ring_2')) isCompatible = true;
        else if (sourceItem.valid_slot_type === 'earring' && (destination.slot === 'earring_1' || destination.slot === 'earring_2')) isCompatible = true;

        if (!isCompatible) {
             await client.query('ROLLBACK');
             return res.status(400).json({ message: `No puedes poner ${sourceItem.name} en ${destination.slot}.` });
        }

        // Swap si hay algo equipado
        const existingItemRes = await client.query(
            'SELECT * FROM player_items WHERE player_id = $1 AND is_equipped = true AND equipped_slot = $2',
            [userId, destination.slot]
        );

        if (existingItemRes.rows.length > 0) {
            const existingItem = existingItemRes.rows[0];
            await client.query(
                'UPDATE player_items SET is_equipped = false, equipped_slot = NULL, bag_slot = $1 WHERE id = $2',
                [sourceItem.bag_slot, existingItem.id] 
            );
        }

        // Equipar y vincular
        await client.query(
            `UPDATE player_items 
             SET is_equipped = true, equipped_slot = $1, bag_slot = NULL, is_bound = true 
             WHERE id = $2`,
            [destination.slot, itemId]
        );
    } 
    
    // --- CASO B: MOVER A MOCHILA (Logica de Stacking) ---
    else if (destination.type === 'bag') {
        const targetBagSlot = destination.slot; 

        // Buscar qué hay en el destino
        const targetItemRes = await client.query(
            'SELECT pi.*, it.stackable FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1 AND pi.is_equipped = false AND pi.bag_slot = $2',
            [userId, targetBagSlot]
        );

        if (targetItemRes.rows.length > 0) {
            const targetItem = targetItemRes.rows[0];

            // 1. ¿Son iguales y stackeables? -> FUSIONAR
            if (sourceItem.stackable && targetItem.stackable && sourceItem.template_id === targetItem.template_id && sourceItem.id !== targetItem.id) {
                const newQuantity = (targetItem.quantity || 1) + (sourceItem.quantity || 1);
                
                // Actualizar destino
                await client.query('UPDATE player_items SET quantity = $1 WHERE id = $2', [newQuantity, targetItem.id]);
                
                // Borrar origen
                await client.query('DELETE FROM player_items WHERE id = $1', [sourceItem.id]);
            } 
            // 2. ¿Son diferentes? -> SWAP (Intercambiar lugares)
            else {
                if (sourceItem.is_equipped) {
                     await client.query('UPDATE player_items SET bag_slot = $1 WHERE id = $2', [sourceItem.bag_slot, targetItem.id]); 
                } else {
                    await client.query('UPDATE player_items SET bag_slot = $1 WHERE id = $2', [sourceItem.bag_slot, targetItem.id]);
                }
                
                // Mover origen al destino
                await client.query(
                    'UPDATE player_items SET is_equipped = false, equipped_slot = NULL, bag_slot = $1 WHERE id = $2',
                    [targetBagSlot, itemId]
                );
            }
        } else {
            // 3. Destino vacío -> MOVER
            await client.query(
                'UPDATE player_items SET is_equipped = false, equipped_slot = NULL, bag_slot = $1 WHERE id = $2',
                [targetBagSlot, itemId]
            );
        }
    }

    await client.query('COMMIT');

    // Devolver inventario actualizado
    const inventoryRes = await client.query(`
        SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, 
        it.image_url, 
        it.price_copper, 
        it.description,
        it.stackable
        FROM player_items pi 
        JOIN items_templates it ON pi.template_id = it.id 
        WHERE pi.player_id = $1
        ORDER BY pi.bag_slot ASC
    `, [userId]);

    res.json({ success: true, inventory: inventoryRes.rows });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Error de inventario' });
  } finally {
      client.release();
  }
};

// ==========================================
// 4. ORGANIZAR INVENTARIO (Sort Restaurado)
// ==========================================
exports.organizeInventory = async (req, res) => {
    const { userId } = req.body;

    const rarityWeight = { 'legendary': 5, 'epic': 4, 'rare': 3, 'uncommon': 2, 'common': 1 };
    const typeWeight = { 'weapon': 4, 'armor': 3, 'accessory': 2, 'consumable': 1 };

    try {
        const itemsRes = await pool.query(`
            SELECT pi.id, pi.template_id, it.rarity, it.type, it.min_level, it.name
            FROM player_items pi
            JOIN items_templates it ON pi.template_id = it.id
            WHERE pi.player_id = $1 AND pi.is_equipped = false
        `, [userId]);

        let items = itemsRes.rows;

        // Algoritmo de ordenamiento
        items.sort((a, b) => {
            // 1. Por Rareza
            const rA = rarityWeight[a.rarity] || 0;
            const rB = rarityWeight[b.rarity] || 0;
            if (rA !== rB) return rB - rA;

            // 2. Por Tipo
            const tA = typeWeight[a.type] || 0;
            const tB = typeWeight[b.type] || 0;
            if (tA !== tB) return tB - tA;

            // 3. Por Nivel
            if (a.min_level !== b.min_level) return b.min_level - a.min_level;
            return 0; 
        });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Reasignar slots en orden (0, 1, 2...)
            for (let i = 0; i < items.length; i++) {
                await client.query('UPDATE player_items SET bag_slot = $1 WHERE id = $2', [i, items[i].id]);
            }
            await client.query('COMMIT');
            
            const inventoryRes = await client.query(`
                SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, 
                it.image_url, it.price_copper, 
                it.description 
                FROM player_items pi 
                JOIN items_templates it ON pi.template_id = it.id 
                WHERE pi.player_id = $1
            `, [userId]);

            res.json({ success: true, inventory: inventoryRes.rows, message: "Inventario organizado." });
        } finally {
            client.release();
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al organizar.' });
    }
};