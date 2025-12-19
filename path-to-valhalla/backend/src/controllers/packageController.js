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

        // JOIN corregido según tus tablas
        const query = `
            SELECT pp.*, 
                   it.name, it.image_url, it.rarity, it.type, it.description 
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
// 2. RECLAMAR PAQUETE (CON SOPORTE DRAG & DROP)
// ==========================================
exports.claimPackage = async (req, res) => {
    const userId = req.user.id;
    // targetSlot es opcional. Si viene, intentamos ponerlo ahí.
    const { packageId, targetSlot } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // A. Obtener paquete e info del template
        // CORRECCIÓN: Usamos 'it.stackable' (booleano) según tu DB. No usamos max_stack.
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

        // B. Determinar destino
        let finalSlot = -1;
        let mustStack = false;
        let stackTargetId = null;

        // CASO 1: Usuario arrastró a un slot específico (targetSlot existe)
        if (targetSlot !== undefined && targetSlot !== null) {
            // Verificamos si hay algo en ese slot
            const slotCheck = await client.query(
                'SELECT id, template_id, quantity FROM player_items WHERE player_id = $1 AND bag_slot = $2', 
                [userId, targetSlot]
            );

            if (slotCheck.rows.length > 0) {
                // Hay un item. ¿Es el mismo y es stackable?
                const existingItem = slotCheck.rows[0];
                if (pkg.stackable && existingItem.template_id === pkg.item_template_id) {
                    mustStack = true;
                    stackTargetId = existingItem.id;
                } else {
                    // Está ocupado por otra cosa. Fallamos (o podrías hacer swap, pero por ahora error)
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Ese espacio está ocupado.' });
                }
            } else {
                // El slot está vacío, perfecto.
                finalSlot = targetSlot;
            }
        } 
        // CASO 2: Usuario hizo clic en el botón (Auto-asignar)
        else {
            // Lógica de Stack automático global
            if (pkg.stackable) {
                const existingRes = await client.query(`
                    SELECT id FROM player_items 
                    WHERE player_id = $1 AND template_id = $2 AND is_equipped = false
                    LIMIT 1
                `, [userId, pkg.item_template_id]);
                
                if (existingRes.rows.length > 0) {
                    mustStack = true;
                    stackTargetId = existingRes.rows[0].id;
                }
            }

            // Si no se stackea, buscar primer hueco libre
            if (!mustStack) {
                const slotsRes = await client.query('SELECT bag_slot FROM player_items WHERE player_id = $1 AND bag_slot IS NOT NULL', [userId]);
                const occupiedSlots = new Set(slotsRes.rows.map(row => row.bag_slot));
                
                // Buscamos hasta 200 slots (5 bolsas)
                for (let i = 0; i < 200; i++) {
                    if (!occupiedSlots.has(i)) {
                        finalSlot = i;
                        break;
                    }
                }
                if (finalSlot === -1) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Inventario lleno.' });
                }
            }
        }

        // C. Ejecutar Acción
        if (mustStack) {
            await client.query('UPDATE player_items SET quantity = quantity + $1 WHERE id = $2', [pkg.quantity, stackTargetId]);
        } else {
            // Insertar nuevo. Usamos las columnas de tu tabla player_items
            await client.query(`
                INSERT INTO player_items 
                (player_id, template_id, bag_slot, quantity, base_stats, is_equipped, durability_current, durability_max, is_bound)
                VALUES ($1, $2, $3, $4, $5, false, 100, 100, false)
            `, [userId, pkg.item_template_id, finalSlot, pkg.quantity, newItemStats]);
        }

        // D. Borrar Paquete
        await client.query('DELETE FROM player_packages WHERE id = $1', [packageId]);

        await client.query('COMMIT');

        // E. Retornar Inventario
        const inventoryRes = await client.query(`
            SELECT pi.*, it.name, it.image_url, it.rarity, it.type, it.icon, it.description, it.price_copper
            FROM player_items pi
            JOIN items_templates it ON pi.template_id = it.id
            WHERE pi.player_id = $1
        `, [userId]);

        res.json({ success: true, inventory: inventoryRes.rows, message: `Reclamado: ${pkg.name}` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error claimPackage:", err);
        res.status(500).json({ message: err.message }); // Enviamos el error real al front
    } finally {
        client.release();
    }
};