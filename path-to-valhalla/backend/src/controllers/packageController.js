const pool = require('../config/db');

// ==========================================
// 1. OBTENER MIS PAQUETES
// ==========================================
exports.getMyPackages = async (req, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    try {
        const countRes = await pool.query('SELECT COUNT(*) FROM player_packages WHERE player_id = $1', [userId]);
        const totalItems = parseInt(countRes.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);

        const query = `
            SELECT pp.*, 
                   it.name, it.image_url, it.rarity, it.type, it.description, it.stackable 
            FROM player_packages pp
            JOIN items_templates it ON pp.item_template_id = it.id
            WHERE pp.player_id = $1
            ORDER BY pp.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [userId, limit, offset]);

        res.json({
            success: true,
            packages: result.rows,
            pagination: { page, totalPages, totalItems }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al obtener paquetes.' });
    }
};

// ==========================================
// 2. RECLAMAR PAQUETE (STACKING POR NOMBRE)
// ==========================================
exports.claimPackage = async (req, res) => {
    const userId = req.user.id;
    const { packageId, targetSlot } = req.body; 

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // A. Obtener info del paquete (incluyendo NOMBRE y STACKABLE)
        const pkgRes = await client.query(`
            SELECT pp.*, it.stackable, it.name 
            FROM player_packages pp
            JOIN items_templates it ON pp.item_template_id = it.id
            WHERE pp.id = $1 AND pp.player_id = $2
        `, [packageId, userId]);

        if (pkgRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Paquete no encontrado.' });
        }

        const pkg = pkgRes.rows[0];
        const newItemStats = pkg.data || {}; 

        let itemToUpdateId = null;
        let finalSlotToInsert = -1;

        // --- LÓGICA MAESTRA: STACKING POR NOMBRE ---
        // Si es stackable, buscamos si existe CUALQUIER item con el MISMO NOMBRE en el inventario.
        // Esto soluciona el problema de tener IDs duplicados (8, 13, 18) en la base de datos.
        if (pkg.stackable) {
            const existingStackRes = await client.query(`
                SELECT pi.id 
                FROM player_items pi
                JOIN items_templates it ON pi.template_id = it.id
                WHERE pi.player_id = $1 
                  AND it.name = $2  -- BUSQUEDA POR NOMBRE EXACTO
                  AND pi.is_equipped = false
                LIMIT 1
            `, [userId, pkg.name]);

            if (existingStackRes.rows.length > 0) {
                itemToUpdateId = existingStackRes.rows[0].id;
            }
        }

        // --- Si no se encontró stack, buscar hueco vacío ---
        if (!itemToUpdateId) {
            // A. Intento en slot específico (Drag & Drop)
            if (targetSlot !== undefined && targetSlot !== null) {
                 const slotCheck = await client.query('SELECT id FROM player_items WHERE player_id = $1 AND bag_slot = $2', [userId, targetSlot]);
                 if (slotCheck.rows.length === 0) {
                     finalSlotToInsert = targetSlot;
                 }
            } 
            
            // B. Búsqueda automática de slot libre
            if (finalSlotToInsert === -1) {
                const slotsRes = await client.query('SELECT bag_slot FROM player_items WHERE player_id = $1 AND bag_slot IS NOT NULL', [userId]);
                const occupiedSlots = new Set(slotsRes.rows.map(row => row.bag_slot));
                
                for (let i = 0; i < 200; i++) {
                    if (!occupiedSlots.has(i)) {
                        finalSlotToInsert = i;
                        break;
                    }
                }
            }

            if (finalSlotToInsert === -1) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Inventario lleno.' });
            }
        }

        // --- EJECUCIÓN ---
        if (itemToUpdateId) {
            await client.query(`UPDATE player_items SET quantity = quantity + $1 WHERE id = $2`, [pkg.quantity, itemToUpdateId]);
        } else {
            await client.query(`
                INSERT INTO player_items 
                (player_id, template_id, bag_slot, quantity, base_stats, is_equipped, durability_current, durability_max, is_bound)
                VALUES ($1, $2, $3, $4, $5, false, 100, 100, false)
            `, [userId, pkg.item_template_id, finalSlotToInsert, pkg.quantity, newItemStats]);
        }

        await client.query('DELETE FROM player_packages WHERE id = $1', [packageId]);
        await client.query('COMMIT');

        // Retornar inventario
        const inventoryRes = await client.query(`
            SELECT pi.*, it.name, it.image_url, it.rarity, it.type, it.icon, it.description, it.price_copper, it.stackable, it.base_stats
            FROM player_items pi
            JOIN items_templates it ON pi.template_id = it.id
            WHERE pi.player_id = $1
            ORDER BY pi.bag_slot ASC
        `, [userId]);

        res.json({ success: true, inventory: inventoryRes.rows, message: `Recibido: ${pkg.name}` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error claimPackage:", err);
        res.status(500).json({ message: 'Error interno.' });
    } finally {
        client.release();
    }
};