const pool = require('../config/db');

// --- HELPER: GENERAR STATS ALEATORIOS (CRÍTICO: ESTO FALTABA) ---
const generateRandomStats = (templateStats) => {
    const finalStats = {};
    if (!templateStats) return {};

    // Recorremos cada atributo (ej: "strength": [1, 2])
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

// Función reutilizable para dar ítems
const giveItemToPlayer = async (userId, templateId, quantity = 1, client = pool) => {
    try {
        // 1. Obtener datos del template
        const templateRes = await client.query('SELECT * FROM items_templates WHERE id = $1', [templateId]);
        if (templateRes.rows.length === 0) return false;
        const template = templateRes.rows[0];

        // 2. Si es stackable (Materiales), buscar si ya existe y sumar
        if (template.stackable) {
            const existingItemRes = await client.query(
                'SELECT id, quantity FROM player_items WHERE player_id = $1 AND template_id = $2 AND is_equipped = false LIMIT 1',
                [userId, templateId]
            );

            if (existingItemRes.rows.length > 0) {
                const item = existingItemRes.rows[0];
                const newQuantity = (item.quantity || 1) + quantity;
                await client.query('UPDATE player_items SET quantity = $1 WHERE id = $2', [newQuantity, item.id]);
                return true; 
            }
        }

        // 3. Si es Equipo (Armas/Armaduras), buscar hueco vacío
        const slotsRes = await client.query('SELECT bag_slot FROM player_items WHERE player_id = $1 AND bag_slot IS NOT NULL', [userId]);
        const occupiedSlots = slotsRes.rows.map(row => row.bag_slot);
        
        let targetSlot = -1;
        for (let i = 0; i < 40; i++) {
            if (!occupiedSlots.includes(i)) {
                targetSlot = i;
                break;
            }
        }

        if (targetSlot === -1) return false; // Inventario lleno

        // 4. INSERT: Creamos el nuevo ítem CON STATS RESUELTOS
        // AQUÍ ESTABA EL ERROR: Usábamos template.base_stats directo
        const uniqueStats = generateRandomStats(template.base_stats); 
        
        await client.query(
            `INSERT INTO player_items 
            (player_id, template_id, is_equipped, bag_slot, quantity, base_stats, durability_current, durability_max, is_bound) 
            VALUES ($1, $2, false, $3, $4, $5, 100, 100, false)`,
            [userId, templateId, targetSlot, quantity, uniqueStats]
        );

        return true; 

    } catch (error) {
        console.error("Error en giveItemToPlayer:", error);
        return false;
    }
};

module.exports = { giveItemToPlayer };