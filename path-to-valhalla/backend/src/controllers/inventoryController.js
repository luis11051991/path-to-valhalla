const pool = require('../config/db');

// --- HELPER: GENERAR STATS ALEATORIOS ---
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

// --- ADMIN: DAR ÍTEM (Generador RNG) ---
exports.adminGiveItem = async (req, res) => {
    const { userId, templateId } = req.body;

    try {
        // 1. Obtener la plantilla
        const templateRes = await pool.query('SELECT * FROM items_templates WHERE id = $1', [templateId]);
        
        if (templateRes.rows.length === 0) {
            return res.status(404).json({ message: 'Ese ID de template no existe.' });
        }
        const template = templateRes.rows[0];

        // 2. Calcular Stats (RNG)
        const uniqueStats = generateRandomStats(template.base_stats);

        // 3. Buscar hueco vacío en mochila (0-39)
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

        // 4. Crear el objeto
        await pool.query(
            `INSERT INTO player_items 
            (player_id, template_id, is_equipped, bag_slot, base_stats, durability_current, durability_max) 
            VALUES ($1, $2, false, $3, $4, 100, 100)`,
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

// --- MOVER ÍTEM (Equipar/Desequipar) ---
exports.moveItem = async (req, res) => {
  const { userId, itemId, destination } = req.body;

  try {
    // 1. Obtener ítem y su template
    const itemQuery = `
        SELECT pi.*, it.slot as valid_slot_type, it.name 
        FROM player_items pi 
        JOIN items_templates it ON pi.template_id = it.id 
        WHERE pi.id = $1 AND pi.player_id = $2
    `;
    const itemRes = await pool.query(itemQuery, [itemId, userId]);

    if (itemRes.rows.length === 0) return res.status(404).json({ message: 'Ítem no encontrado.' });

    const item = itemRes.rows[0];

    await pool.query('BEGIN');

    // CASO A: EQUIPAR
    if (destination.type === 'equipped') {
        
        // VALIDACIÓN DE TIPOS
        let isCompatible = false;
        // Coincidencia exacta
        if (item.valid_slot_type === destination.slot) isCompatible = true;
        // Anillos (ring -> ring_1 / ring_2)
        else if (item.valid_slot_type === 'ring' && (destination.slot === 'ring_1' || destination.slot === 'ring_2')) isCompatible = true;
        // Aretes (earring -> earring_1 / earring_2)
        else if (item.valid_slot_type === 'earring' && (destination.slot === 'earring_1' || destination.slot === 'earring_2')) isCompatible = true;

        if (!isCompatible) {
             await pool.query('ROLLBACK');
             return res.status(400).json({ message: `No puedes poner ${item.name} en ${destination.slot}.` });
        }

        // Verificar si hay algo puesto
        const existingItemRes = await pool.query(
            'SELECT * FROM player_items WHERE player_id = $1 AND is_equipped = true AND equipped_slot = $2',
            [userId, destination.slot]
        );

        // Desequipar el existente (Intercambio a mochila)
        if (existingItemRes.rows.length > 0) {
            const existingItem = existingItemRes.rows[0];
            await pool.query(
                'UPDATE player_items SET is_equipped = false, equipped_slot = NULL, bag_slot = $1 WHERE id = $2',
                [item.bag_slot, existingItem.id]
            );
        }

        // Equipar el nuevo
        await pool.query(
            'UPDATE player_items SET is_equipped = true, equipped_slot = $1, bag_slot = NULL WHERE id = $2',
            [destination.slot, itemId]
        );
    } 
    
    // CASO B: MOVER A MOCHILA
    else if (destination.type === 'bag') {
        const targetBagSlot = destination.slot; 

        // Verificar ocupante
        const targetItemRes = await pool.query(
            'SELECT * FROM player_items WHERE player_id = $1 AND is_equipped = false AND bag_slot = $2',
            [userId, targetBagSlot]
        );

        if (targetItemRes.rows.length > 0) {
            // Intercambio simple
            const targetItem = targetItemRes.rows[0];
            
            if (item.is_equipped) {
                 // Si viene del cuerpo, mandamos el de la mochila al hueco libre (si existe logica compleja)
                 // Por ahora: Intercambio de slot de mochila
                 await pool.query('UPDATE player_items SET bag_slot = $1 WHERE id = $2', [item.bag_slot, targetItem.id]); 
            } else {
                // Mochila a Mochila
                await pool.query('UPDATE player_items SET bag_slot = $1 WHERE id = $2', [item.bag_slot, targetItem.id]);
            }
        }

        // Mover ítem
        await pool.query(
            'UPDATE player_items SET is_equipped = false, equipped_slot = NULL, bag_slot = $1 WHERE id = $2',
            [targetBagSlot, itemId]
        );
    }

    await pool.query('COMMIT');

    // Devolver inventario actualizado
    const inventoryRes = await pool.query(`
        SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.image_url, it.base_stats, it.description 
        FROM player_items pi 
        JOIN items_templates it ON pi.template_id = it.id 
        WHERE pi.player_id = $1
    `, [userId]);

    res.json({ success: true, inventory: inventoryRes.rows });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Error de inventario' });
  }
};