const pool = require('../config/db');

// ==========================================
// 1. HELPER: GENERAR STATS ALEATORIOS
// ==========================================
const generateRandomStats = (templateStats) => {
    const finalStats = {};
    
    // Recorremos cada atributo (ej: "strength": [2, 5])
    for (const [key, value] of Object.entries(templateStats)) {
        // Si es un array [min, max], tiramos dados
        if (Array.isArray(value) && value.length === 2) {
            const min = value[0];
            const max = value[1];
            
            // Fórmula: Entero aleatorio entre min y max
            const roll = Math.floor(Math.random() * (max - min + 1)) + min;
            finalStats[key] = roll;
        } else {
            // Si es un número fijo, lo dejamos igual
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

        // D. Crear el objeto en la base de datos (Tradeable por defecto)
        await pool.query(
            `INSERT INTO player_items 
            (player_id, template_id, is_equipped, bag_slot, base_stats, durability_current, durability_max, is_bound) 
            VALUES ($1, $2, false, $3, $4, 100, 100, false)`,
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
// 3. MOVER ÍTEM (Equipar / Desequipar / Mover)
// ==========================================
exports.moveItem = async (req, res) => {
  const { userId, itemId, destination } = req.body;

  try {
    // A. Obtener ítem y su template para validar
    const itemQuery = `
        SELECT pi.*, it.slot as valid_slot_type, it.name 
        FROM player_items pi 
        JOIN items_templates it ON pi.template_id = it.id 
        WHERE pi.id = $1 AND pi.player_id = $2
    `;
    const itemRes = await pool.query(itemQuery, [itemId, userId]);

    if (itemRes.rows.length === 0) return res.status(404).json({ message: 'Ítem no encontrado.' });

    const item = itemRes.rows[0];

    // Iniciamos transacción para evitar errores de duplicados temporales
    await pool.query('BEGIN');

    // --- CASO A: EQUIPAR (Mochila -> Personaje) ---
    if (destination.type === 'equipped') {
        
        // 1. Validación estricta de tipos
        let isCompatible = false;
        
        if (item.valid_slot_type === destination.slot) isCompatible = true;
        else if (item.valid_slot_type === 'ring' && (destination.slot === 'ring_1' || destination.slot === 'ring_2')) isCompatible = true;
        else if (item.valid_slot_type === 'earring' && (destination.slot === 'earring_1' || destination.slot === 'earring_2')) isCompatible = true;

        if (!isCompatible) {
             await pool.query('ROLLBACK');
             return res.status(400).json({ message: `No puedes poner ${item.name} en ${destination.slot}.` });
        }

        // 2. Verificar si ya hay algo puesto en ese slot
        const existingItemRes = await pool.query(
            'SELECT * FROM player_items WHERE player_id = $1 AND is_equipped = true AND equipped_slot = $2',
            [userId, destination.slot]
        );

        // 3. Si hay algo, lo desequipamos (Swap)
        if (existingItemRes.rows.length > 0) {
            const existingItem = existingItemRes.rows[0];
            await pool.query(
                'UPDATE player_items SET is_equipped = false, equipped_slot = NULL, bag_slot = $1 WHERE id = $2',
                [item.bag_slot, existingItem.id] 
            );
        }

        // 4. Equipar el nuevo ítem Y VINCULARLO (BIND ON EQUIP)
        // Agregamos: is_bound = true
        await pool.query(
            `UPDATE player_items 
             SET is_equipped = true, 
                 equipped_slot = $1, 
                 bag_slot = NULL, 
                 is_bound = true 
             WHERE id = $2`,
            [destination.slot, itemId]
        );
    } 
    
    // --- CASO B: MOVER A MOCHILA (Personaje -> Mochila O Mochila -> Mochila) ---
    else if (destination.type === 'bag') {
        const targetBagSlot = destination.slot; 

        // 1. Verificar si el hueco destino está ocupado
        const targetItemRes = await pool.query(
            'SELECT * FROM player_items WHERE player_id = $1 AND is_equipped = false AND bag_slot = $2',
            [userId, targetBagSlot]
        );

        if (targetItemRes.rows.length > 0) {
            const targetItem = targetItemRes.rows[0];
            
            if (item.is_equipped) {
                 await pool.query('UPDATE player_items SET bag_slot = $1 WHERE id = $2', [item.bag_slot, targetItem.id]); 
            } else {
                await pool.query('UPDATE player_items SET bag_slot = $1 WHERE id = $2', [item.bag_slot, targetItem.id]);
            }
        }

        // 2. Mover el ítem original al destino
        await pool.query(
            'UPDATE player_items SET is_equipped = false, equipped_slot = NULL, bag_slot = $1 WHERE id = $2',
            [targetBagSlot, itemId]
        );
    }

    await pool.query('COMMIT');

    // C. Devolver inventario actualizado
    const inventoryRes = await pool.query(`
        SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, 
        it.image_url, 
        it.price_copper, 
        it.description 
        FROM player_items pi 
        JOIN items_templates it ON pi.template_id = it.id 
        WHERE pi.player_id = $1
        ORDER BY pi.bag_slot ASC
    `, [userId]);

    res.json({ success: true, inventory: inventoryRes.rows });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Error de inventario' });
  }
};

// ==========================================
// 4. ORGANIZAR INVENTARIO (Sort)
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

        items.sort((a, b) => {
            const rA = rarityWeight[a.rarity] || 0;
            const rB = rarityWeight[b.rarity] || 0;
            if (rA !== rB) return rB - rA;

            const tA = typeWeight[a.type] || 0;
            const tB = typeWeight[b.type] || 0;
            if (tA !== tB) return tB - tA;

            if (a.min_level !== b.min_level) return b.min_level - a.min_level;
            return 0; 
        });

        await pool.query('BEGIN');
        for (let i = 0; i < items.length; i++) {
            await pool.query('UPDATE player_items SET bag_slot = $1 WHERE id = $2', [i, items[i].id]);
        }
        await pool.query('COMMIT');

        const inventoryRes = await pool.query(`
            SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, 
            it.image_url, it.price_copper, 
            it.description 
            FROM player_items pi 
            JOIN items_templates it ON pi.template_id = it.id 
            WHERE pi.player_id = $1
        `, [userId]);

        res.json({ success: true, inventory: inventoryRes.rows, message: "Inventario organizado." });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error al organizar.' });
    }
};