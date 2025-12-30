const pool = require('../config/db');
const { hydratePlayer } = require('../shared/player_stats');

// --- OBTENER MIS MASCOTAS ---
exports.getMyPets = async (req, res) => {
    const userId = req.user.id;

    try {
        const query = `
            SELECT pp.id as player_pet_id, pp.current_hunger, pp.is_active, pp.nickname,
                   p.name, p.description, p.image_url, p.tier, p.bonus_stats, p.max_hunger, p.code
            FROM player_pets pp
            JOIN pets p ON pp.pet_id = p.id
            WHERE pp.player_id = $1
            ORDER BY pp.is_active DESC, p.tier DESC
        `;
        
        const result = await pool.query(query, [userId]);
        res.json({ success: true, pets: result.rows });

    } catch (err) {
        console.error("Error obteniendo mascotas:", err);
        res.status(500).json({ message: 'Error al cargar el establo.' });
    }
};

// --- EQUIPAR MASCOTA ---
exports.equipPet = async (req, res) => {
    const userId = req.user.id;
    const { playerPetId } = req.body;

    try {
        await pool.query('BEGIN');
        await pool.query('UPDATE player_pets SET is_active = false WHERE player_id = $1', [userId]);
        await pool.query('UPDATE player_pets SET is_active = true WHERE id = $1 AND player_id = $2', [playerPetId, userId]);
        await pool.query('COMMIT');

        const petsRes = await pool.query(`
            SELECT pp.id as player_pet_id, pp.current_hunger, pp.is_active, pp.nickname,
                   p.name, p.description, p.image_url, p.tier, p.bonus_stats, p.max_hunger, p.code
            FROM player_pets pp
            JOIN pets p ON pp.pet_id = p.id
            WHERE pp.player_id = $1
            ORDER BY pp.is_active DESC, p.tier DESC
        `, [userId]);

        const hydrated = await hydratePlayer(userId);
        const bgResult = await pool.query('SELECT image_url FROM backgrounds WHERE id = $1', [hydrated.active_background_id || 1]);
        const bagsResult = await pool.query('SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()', [userId]);
        const user = {
            ...hydrated,
            active_background_url: bgResult.rows[0]?.image_url || hydrated.active_background_url,
            real_inventory: (await pool.query(`SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.image_url, it.price_copper, it.description, it.stackable FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1 ORDER BY pi.bag_slot ASC`, [userId])).rows,
            rented_bags: bagsResult.rows
        };

        res.json({ success: true, pets: petsRes.rows, user });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error("Error equipando mascota:", err);
        res.status(500).json({ message: 'No se pudo equipar la mascota.' });
    }
};

// --- ALIMENTAR MASCOTA (CON LÓGICA DE MONEDAS G/S/C) ---
exports.feedPet = async (req, res) => {
    const userId = req.user.id;
    const { playerPetId } = req.body;
    const HEAL_AMOUNT = 20;

    try {
        // 1. Obtener info de la mascota y del dinero del jugador
        const petRes = await pool.query(`
            SELECT pp.*, p.tier 
            FROM player_pets pp
            JOIN pets p ON pp.pet_id = p.id
            WHERE pp.id = $1 AND pp.player_id = $2
        `, [playerPetId, userId]);

        if (petRes.rows.length === 0) return res.status(404).json({ message: 'Mascota no encontrada.' });
        const pet = petRes.rows[0];
        
        if (pet.current_hunger >= 100) return res.status(400).json({ message: 'Tu mascota ya está llena.' });

        // 2. Definir Costos
        let costCopperVal = 0;
        let costText = "";

        if (pet.tier === 1) {
            costCopperVal = 10; 
            costText = "10 de Cobre";
        } else if (pet.tier === 2) {
            costCopperVal = 500; // 5 Plata
            costText = "5 de Plata";
        } else if (pet.tier >= 3) {
            costCopperVal = 10000; // 1 Oro
            costText = "1 de Oro";
        }

        // 3. Obtener dinero actual del jugador
        const playerRes = await pool.query('SELECT gold, silver, copper FROM players WHERE id = $1', [userId]);
        const { gold, silver, copper } = playerRes.rows[0];

        // 4. Calcular "Riqueza Total" en base Cobre
        // (Convertimos todo a cobre para facilitar la resta)
        const currentTotalCopper = (parseInt(gold) * 10000) + (parseInt(silver) * 100) + parseInt(copper);

        if (currentTotalCopper < costCopperVal) {
            return res.status(400).json({ message: `No tienes suficiente dinero. Necesitas ${costText}.` });
        }

        // 5. Restar costo y recalcular monedas
        const newTotalCopper = currentTotalCopper - costCopperVal;

        const newGold = Math.floor(newTotalCopper / 10000);
        const remainderAfterGold = newTotalCopper % 10000;
        const newSilver = Math.floor(remainderAfterGold / 100);
        const newCopper = remainderAfterGold % 100;

        await pool.query('BEGIN');

        // Actualizar dinero del jugador
        await pool.query(
            'UPDATE players SET gold = $1, silver = $2, copper = $3 WHERE id = $4', 
            [newGold, newSilver, newCopper, userId]
        );

        // Curar mascota
        await pool.query(`
            UPDATE player_pets 
            SET current_hunger = LEAST(current_hunger + $1, 100) 
            WHERE id = $2
        `, [HEAL_AMOUNT, playerPetId]);

        await pool.query('COMMIT');

        // Devolvemos el mensaje y los nuevos valores de dinero para actualizar el frontend
        res.json({ 
            success: true, 
            message: `Mascota alimentada (+${HEAL_AMOUNT}). Pagaste ${costText}.`,
            newMoney: { gold: newGold, silver: newSilver, copper: newCopper } // Opcional, por si queremos actualizar la UI al instante
        });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error("Error alimentando:", err);
        res.status(500).json({ message: 'Error al procesar el pago.' });
    }
};

// --- FUNCIÓN INTERNA: DESGASTAR MASCOTA ---
exports.decreasePetHungerInternal = async (userId, hungerAmount = 1) => {
    try {
        const activePetRes = await pool.query(
            'SELECT id, current_hunger FROM player_pets WHERE player_id = $1 AND is_active = true', 
            [userId]
        );

        if (activePetRes.rows.length === 0) return; 

        const pet = activePetRes.rows[0];
        let newHunger = pet.current_hunger - hungerAmount;
        if (newHunger < 0) newHunger = 0;

        await pool.query(
            'UPDATE player_pets SET current_hunger = $1 WHERE id = $2',
            [newHunger, pet.id]
        );

        return true; 
    } catch (err) {
        console.error("Error desgastando mascota:", err);
        return false; 
    }
};
