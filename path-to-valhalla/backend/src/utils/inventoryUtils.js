const pool = require('../config/db');

// Función reutilizable para dar ítems (con soporte de Stacking)
const giveItemToPlayer = async (userId, templateId, quantity = 1, client = pool) => {
    try {
        // 1. Obtener datos del template (para saber si es stackable)
        const templateRes = await client.query('SELECT * FROM items_templates WHERE id = $1', [templateId]);
        if (templateRes.rows.length === 0) return false;
        const template = templateRes.rows[0];

        // 2. Si es stackable, buscar si ya existe en la mochila (no equipado)
        if (template.stackable) {
            const existingItemRes = await client.query(
                'SELECT id, quantity FROM player_items WHERE player_id = $1 AND template_id = $2 AND is_equipped = false LIMIT 1',
                [userId, templateId]
            );

            if (existingItemRes.rows.length > 0) {
                // UPDATE: Sumamos la cantidad
                const item = existingItemRes.rows[0];
                const newQuantity = (item.quantity || 1) + quantity;
                await client.query('UPDATE player_items SET quantity = $1 WHERE id = $2', [newQuantity, item.id]);
                return true; // Éxito (Stack actualizado)
            }
        }

        // 3. Si no es stackable o no existe, buscamos un hueco vacío
        const slotsRes = await client.query('SELECT bag_slot FROM player_items WHERE player_id = $1 AND bag_slot IS NOT NULL', [userId]);
        const occupiedSlots = slotsRes.rows.map(row => row.bag_slot);
        
        let targetSlot = -1;
        // Buscamos el primer hueco libre (0 a 39)
        for (let i = 0; i < 40; i++) {
            if (!occupiedSlots.includes(i)) {
                targetSlot = i;
                break;
            }
        }

        if (targetSlot === -1) return false; // Inventario lleno

        // 4. INSERT: Creamos el nuevo ítem
        // Generamos stats base (si tiene rangos)
        const stats = template.base_stats || {}; 
        // Aquí podrías llamar a tu función generateRandomStats si la exportaras, 
        // pero por simplicidad en drops usaremos los base_stats del template o un JSON vacío.
        
        await client.query(
            `INSERT INTO player_items 
            (player_id, template_id, is_equipped, bag_slot, quantity, base_stats, durability_current, durability_max, is_bound) 
            VALUES ($1, $2, false, $3, $4, $5, 100, 100, false)`,
            [userId, templateId, targetSlot, quantity, stats]
        );

        return true; // Éxito (Nuevo ítem creado)

    } catch (error) {
        console.error("Error en giveItemToPlayer:", error);
        return false;
    }
};

module.exports = { giveItemToPlayer };