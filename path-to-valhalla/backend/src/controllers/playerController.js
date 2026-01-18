const pool = require('../config/db');
const { hydratePlayer } = require('../shared/player_stats');

// Configuración de Fondos por Raza
const RACE_BACKGROUNDS = {
    'human': 1, 'elf': 2, 'dwarf': 3, 'orc': 4, 'feline': 5, 'goblin': 6
};

// Configuración de CLASES por Raza
const RACE_CLASSES = {
    'human': 1, 'humano': 1,
    'elf': 2, 'elfo': 2,
    'dwarf': 3, 'enano': 3, 'duende': 3,
    'goblin': 4,
    'orc': 5, 'orco': 5,
    'feline': 6, 'felino': 6
};

// --- ELEGIR RAZA (Paso 2 del Registro) ---
exports.chooseRace = async (req, res) => {
    const { userId, race, stats, backgroundId, gender } = req.body;

    try {
        const raceKey = race ? race.toLowerCase() : 'human';

        // 1. Determinar IDs correctos
        const correctBgId = RACE_BACKGROUNDS[raceKey] || 1;
        const activeBg = backgroundId || correctBgId;
        const correctClassId = RACE_CLASSES[raceKey] || 1;

        const safeGender = (gender === 'female') ? 'female' : 'male';

        // 2. Actualizar Jugador
        await pool.query(
            'UPDATE players SET race = $1, stats = $2, active_background_id = $3, gender = $4, class_id = $5 WHERE id = $6',
            [raceKey, stats, activeBg, safeGender, correctClassId, userId]
        );

        // 3. Registrar Fondo
        await pool.query('INSERT INTO player_backgrounds (player_id, background_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, activeBg]);

        // 4. Devolver usuario actualizado
        const finalUserRes = await pool.query(`
        SELECT p.*, b.image_url as active_background_url, c.name as class_name 
        FROM players p 
        LEFT JOIN backgrounds b ON p.active_background_id = b.id 
        LEFT JOIN classes c ON p.class_id = c.id
        WHERE p.id = $1
    `, [userId]);

        const finalUser = finalUserRes.rows[0];

        // Cargar inventario y bolsas
        const itemsQuery = `
        SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, 
        it.image_url, it.price_copper,
        it.description 
        FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1`;
        const itemsResult = await pool.query(itemsQuery, [userId]);
        finalUser.real_inventory = itemsResult.rows;

        const bagsRes = await pool.query('SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()', [userId]);
        finalUser.rented_bags = bagsRes.rows;

        let hydratedUser = await hydratePlayer(finalUser);
        hydratedUser.real_inventory = itemsResult.rows;
        hydratedUser.rented_bags = bagsRes.rows;

        res.json({ success: true, user: hydratedUser });
    } catch (err) {
        console.error("Error en chooseRace:", err);
        res.status(500).json({ message: 'Error al elegir raza' });
    }
};

// --- ENTRENAR STATS ---
exports.trainStats = async (req, res) => {
    const { userId, newStats, pointsSpent } = req.body;

    try {
        const userResult = await pool.query('SELECT stat_points, stats FROM players WHERE id = $1', [userId]);
        const currentUser = userResult.rows[0];

        if (currentUser.stat_points < pointsSpent) return res.status(400).json({ message: 'No tienes suficientes puntos.' });

        await pool.query('UPDATE players SET stats = $1, stat_points = $2 WHERE id = $3', [newStats, currentUser.stat_points - pointsSpent, userId]);

        // Devolver usuario completo actualizado
        const finalUserRes = await pool.query(`
        SELECT p.*, b.image_url as active_background_url, c.name as class_name 
        FROM players p 
        LEFT JOIN backgrounds b ON p.active_background_id = b.id 
        LEFT JOIN classes c ON p.class_id = c.id
        WHERE p.id = $1
    `, [userId]);
        const finalUser = finalUserRes.rows[0];

        const itemsQuery = `
        SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, 
        it.image_url, it.price_copper,
        it.description 
        FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1`;
        const itemsResult = await pool.query(itemsQuery, [userId]);
        finalUser.real_inventory = itemsResult.rows;

        const bagsRes = await pool.query('SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()', [userId]);
        finalUser.rented_bags = bagsRes.rows;

        const hydrated = await hydratePlayer(finalUser);
        hydrated.real_inventory = itemsResult.rows;
        hydrated.rented_bags = bagsRes.rows;

        res.json({ success: true, user: hydrated });

    } catch (err) { console.error(err); res.status(500).json({ message: 'Error al entrenar' }); }
};

// --- ALQUILAR MOCHILA ---
exports.rentBag = async (req, res) => {
    const { userId, bagNumber } = req.body;
    const COST = 50; const DAYS = 7;

    try {
        const userRes = await pool.query('SELECT onix FROM players WHERE id = $1', [userId]);
        if (userRes.rows[0].onix < COST) return res.status(400).json({ message: 'No tienes suficiente Ónix.' });

        const rentalCheck = await pool.query('SELECT expires_at FROM player_bag_rentals WHERE player_id = $1 AND bag_number = $2', [userId, bagNumber]);
        let baseDate = new Date();
        if (rentalCheck.rows.length > 0 && new Date(rentalCheck.rows[0].expires_at) > baseDate) {
            baseDate = new Date(rentalCheck.rows[0].expires_at);
        }
        const newExpiryDate = new Date(baseDate); newExpiryDate.setDate(newExpiryDate.getDate() + DAYS);

        await pool.query('BEGIN');
        await pool.query('UPDATE players SET onix = onix - $1 WHERE id = $2', [COST, userId]);
        await pool.query(`INSERT INTO player_bag_rentals (player_id, bag_number, expires_at) VALUES ($1, $2, $3) ON CONFLICT (player_id, bag_number) DO UPDATE SET expires_at = $3`, [userId, bagNumber, newExpiryDate]);
        await pool.query('COMMIT');

        const updatedUserRes = await pool.query(`
        SELECT p.*, b.image_url as active_background_url, c.name as class_name 
        FROM players p 
        LEFT JOIN backgrounds b ON p.active_background_id = b.id 
        LEFT JOIN classes c ON p.class_id = c.id 
        WHERE p.id = $1
    `, [userId]);

        const updatedUser = updatedUserRes.rows[0];
        const itemsQuery = `SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.image_url, it.price_copper, it.description FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1`;
        const itemsResult = await pool.query(itemsQuery, [userId]);

        updatedUser.real_inventory = itemsResult.rows;
        updatedUser.rented_bags = (await pool.query('SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()', [userId])).rows;

        const hydrated = await hydratePlayer(updatedUser);
        hydrated.real_inventory = updatedUser.real_inventory;
        hydrated.rented_bags = updatedUser.rented_bags;

        res.json({ success: true, user: hydrated, message: 'Bolsa extendida!' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message || 'Error al alquilar' });
    }
};

// --- GESTIÓN DE HABILIDADES (MEJORADO) ---
exports.getMySkills = async (req, res) => {
    const userId = req.user.id;
    try {
        const playerRes = await pool.query('SELECT class_id FROM players WHERE id = $1', [userId]);
        if (playerRes.rows.length === 0) return res.status(404).json({ message: 'Jugador no encontrado' });

        const classId = playerRes.rows[0].class_id;

        // Auto-aprender skills de la clase si no los tiene (ACUMULATIVO)
        if (classId) {
            const availableSkills = await pool.query('SELECT id FROM skills WHERE class_id = $1', [classId]);
            for (let skill of availableSkills.rows) {
                await pool.query(`
                    INSERT INTO player_skills (player_id, skill_id, is_equipped, skill_level)
                    SELECT $1, $2, false, 1
                    WHERE NOT EXISTS (SELECT 1 FROM player_skills WHERE player_id = $1 AND skill_id = $2)
                `, [userId, skill.id]);
            }
        }

        // QUERY ACTUALIZADA: Trae precio base, chance, scaling, etc.
        const mySkillsQuery = `
            SELECT ps.id as player_skill_id, ps.is_equipped, ps.skill_level,
                   s.name, s.description, s.icon, s.image_url, 
                   s.energy_cost, s.cooldown_seconds, 
                   s.damage_min, s.damage_max, s.heal_amount, 
                   s.scaling_stat, s.scaling_factor,
                   s.price_gold as base_price,
                   s.max_level,
                   s.trigger_chance
            FROM player_skills ps
            JOIN skills s ON ps.skill_id = s.id
            WHERE ps.player_id = $1
            ORDER BY ps.is_equipped DESC, s.name ASC
        `;

        const result = await pool.query(mySkillsQuery, [userId]);
        res.json({ success: true, skills: result.rows });

    } catch (err) {
        console.error("Error obteniendo skills:", err);
        res.status(500).json({ message: 'Error del servidor al cargar grimorio.' });
    }
};

// --- EQUIPAR HABILIDAD ---
exports.equipSkill = async (req, res) => {
    const userId = req.user.id;
    const { skillId } = req.body;
    try {
        const playerRes = await pool.query('SELECT level FROM players WHERE id = $1', [userId]);
        if (playerRes.rows.length === 0) return res.status(404).json({ message: 'Jugador no encontrado' });
        const level = playerRes.rows[0].level;

        let maxSlots = 2;
        if (level >= 100) maxSlots = 5;
        else if (level >= 50) maxSlots = 4;
        else if (level >= 10) maxSlots = 3;

        // Comprobar estado actual
        const skillCheck = await pool.query('SELECT is_equipped FROM player_skills WHERE id = $1 AND player_id = $2', [skillId, userId]);
        if (skillCheck.rows.length === 0) return res.status(400).json({ message: 'Habilidad no encontrada.' });

        const isCurrentlyEquipped = skillCheck.rows[0].is_equipped;

        if (isCurrentlyEquipped) {
            // Desequipar
            await pool.query('UPDATE player_skills SET is_equipped = false, slot_index = 0 WHERE id = $1', [skillId]);
            res.json({ success: true, message: 'Habilidad desequipada.' });
        } else {
            // Equipar: Verificar espacio
            const equippedCountRes = await pool.query('SELECT COUNT(*) FROM player_skills WHERE player_id = $1 AND is_equipped = true', [userId]);
            const equippedCount = parseInt(equippedCountRes.rows[0].count);

            if (equippedCount >= maxSlots) {
                return res.status(400).json({ message: `¡Ranuras llenas! Tienes ${maxSlots} espacios disponibles (Nivel ${level}).` });
            }

            // Asignar slot
            const nextSlot = equippedCount + 1;
            await pool.query('UPDATE player_skills SET is_equipped = true, slot_index = $1 WHERE id = $2', [nextSlot, skillId]);
            res.json({ success: true, message: 'Habilidad equipada.' });
        }
    } catch (err) { console.error("Error al equipar skill:", err); res.status(500).json({ message: 'Error del servidor.' }); }
};

// --- BUSCAR JUGADORES (AUTOCOMPLETE) ---
exports.searchUsers = async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 3) {
        return res.json([]);
    }

    try {
        // Búsqueda case-insensitive, limite 10
        const result = await pool.query(
            'SELECT id, username FROM players WHERE username ILIKE $1 LIMIT 10',
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error buscando usuarios:", err);
        res.status(500).json({ message: 'Error en búsqueda' });
    }
};
