const pool = require('../config/db');

// MAPEO: Raza -> ID del Fondo (Igual que en authController)
const RACE_BACKGROUNDS = {
  'human': 1,
  'elf': 2,
  'dwarf': 3,
  'orc': 4,
  'feline': 5,
  'goblin': 6
};

// --- ELEGIR RAZA (CORREGIDO) ---
exports.chooseRace = async (req, res) => {
  // Recibimos userId, race (ej: 'orc'), stats y gender
  const { userId, race, stats, backgroundId, gender } = req.body;
  
  try {
    // 1. Determinar el Fondo según la Raza elegida
    // Si no enviamos backgroundId explícito, lo buscamos en el mapa.
    const raceKey = race ? race.toLowerCase() : 'human';
    const correctBgId = RACE_BACKGROUNDS[raceKey] || 1; 
    
    // Usamos el que acabamos de calcular (correctBgId)
    const activeBg = backgroundId || correctBgId; 

    // Validar género
    const safeGender = (gender === 'female') ? 'female' : 'male';

    // 2. Actualizar Jugador
    await pool.query(
      'UPDATE players SET race = $1, stats = $2, active_background_id = $3, gender = $4 WHERE id = $5',
      [raceKey, stats, activeBg, safeGender, userId]
    );
    
    // 3. Dar Propiedad del Fondo (Para que salga desbloqueado)
    await pool.query('INSERT INTO player_backgrounds (player_id, background_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, activeBg]);

    // 4. Devolver usuario actualizado (CON LA URL DEL FONDO)
    // Hacemos JOIN para devolver la URL exacta y que el frontend la muestre al instante
    const finalUserQuery = `
      SELECT p.*, b.image_url as active_background_url
      FROM players p
      LEFT JOIN backgrounds b ON p.active_background_id = b.id
      WHERE p.id = $1
    `;
    const finalUserResult = await pool.query(finalUserQuery, [userId]);
    const finalUser = finalUserResult.rows[0];

    // Recuperamos inventario y bolsas para no perder datos en el estado del front
    const itemsQuery = `SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.base_stats, it.description FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1`;
    const itemsResult = await pool.query(itemsQuery, [userId]);
    finalUser.real_inventory = itemsResult.rows;

    const bagsRes = await pool.query('SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()', [userId]);
    finalUser.rented_bags = bagsRes.rows;

    res.json({ success: true, user: finalUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al elegir raza' });
  }
};

// --- ENTRENAR STATS ---
exports.trainStats = async (req, res) => {
  const { userId, newStats, pointsSpent } = req.body;

  try {
    const userResult = await pool.query('SELECT stat_points, stats FROM players WHERE id = $1', [userId]);
    const currentUser = userResult.rows[0];

    if (currentUser.stat_points < pointsSpent) {
      return res.status(400).json({ message: 'No tienes suficientes puntos.' });
    }

    const remainingPoints = currentUser.stat_points - pointsSpent;
    
    await pool.query(
      'UPDATE players SET stats = $1, stat_points = $2 WHERE id = $3',
      [newStats, remainingPoints, userId]
    );

    const finalUserQuery = `
      SELECT p.*, b.image_url as active_background_url
      FROM players p
      LEFT JOIN backgrounds b ON p.active_background_id = b.id
      WHERE p.id = $1
    `;
    const finalUserResult = await pool.query(finalUserQuery, [userId]);
    const finalUser = finalUserResult.rows[0];

    const itemsQuery = `SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.base_stats, it.description FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1`;
    const itemsResult = await pool.query(itemsQuery, [userId]);
    finalUser.real_inventory = itemsResult.rows;

    const bagsRes = await pool.query('SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()', [userId]);
    finalUser.rented_bags = bagsRes.rows;

    res.json({ success: true, user: finalUser });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al entrenar' });
  }
};

// --- ALQUILAR MOCHILA ---
exports.rentBag = async (req, res) => {
  const { userId, bagNumber } = req.body;
  const COST = 50; 
  const DAYS = 7; 

  try {
    const userRes = await pool.query('SELECT onix FROM players WHERE id = $1', [userId]);
    const userOnix = userRes.rows[0].onix;

    if (userOnix < COST) {
      return res.status(400).json({ message: 'No tienes suficiente Ónix (Necesitas 50).' });
    }

    const rentalCheck = await pool.query('SELECT expires_at FROM player_bag_rentals WHERE player_id = $1 AND bag_number = $2', [userId, bagNumber]);
    let baseDate = new Date();
    if (rentalCheck.rows.length > 0) {
        const currentExpiry = new Date(rentalCheck.rows[0].expires_at);
        if (currentExpiry > baseDate) baseDate = currentExpiry;
    }
    const newExpiryDate = new Date(baseDate);
    newExpiryDate.setDate(newExpiryDate.getDate() + DAYS);

    await pool.query('BEGIN');
    await pool.query('UPDATE players SET onix = onix - $1 WHERE id = $2', [COST, userId]);
    await pool.query(`INSERT INTO player_bag_rentals (player_id, bag_number, expires_at) VALUES ($1, $2, $3) ON CONFLICT (player_id, bag_number) DO UPDATE SET expires_at = $3`, [userId, bagNumber, newExpiryDate]);
    await pool.query('COMMIT');

    const finalUserRes = await pool.query(`SELECT p.*, b.image_url as active_background_url FROM players p LEFT JOIN backgrounds b ON p.active_background_id = b.id WHERE p.id = $1`, [userId]);
    const updatedUser = finalUserRes.rows[0];

    const itemsQuery = `SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.base_stats, it.description FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1`;
    const itemsResult = await pool.query(itemsQuery, [userId]);
    updatedUser.real_inventory = itemsResult.rows;

    const bagsRes = await pool.query('SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()', [userId]);
    updatedUser.rented_bags = bagsRes.rows;

    res.json({ success: true, user: updatedUser, message: `¡Bolsa ${bagNumber} extendida exitosamente!` });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Error al alquilar bolsa' });
  }
};