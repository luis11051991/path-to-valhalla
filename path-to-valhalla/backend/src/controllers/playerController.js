const pool = require('../config/db');

// --- ELEGIR RAZA ---
exports.chooseRace = async (req, res) => {
  const { userId, race, stats, backgroundId } = req.body;
  try {
    const activeBg = backgroundId || 1;
    await pool.query(
      'UPDATE players SET race = $1, stats = $2, active_background_id = $3 WHERE id = $4',
      [race, stats, activeBg, userId]
    );
    // Asegurar propiedad del fondo
    await pool.query('INSERT INTO player_backgrounds (player_id, background_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, activeBg]);

    // Devolver usuario actualizado
    const updatedUser = await pool.query('SELECT * FROM players WHERE id = $1', [userId]);
    res.json({ success: true, user: updatedUser.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al elegir raza' });
  }
};

// --- ENTRENAR STATS ---
exports.trainStats = async (req, res) => {
  const { userId, newStats, pointsSpent } = req.body;

  try {
    // 1. Verificamos que el usuario tenga puntos suficientes en la DB (Seguridad)
    const userResult = await pool.query('SELECT stat_points, stats FROM players WHERE id = $1', [userId]);
    const currentUser = userResult.rows[0];

    if (currentUser.stat_points < pointsSpent) {
      return res.status(400).json({ message: 'No tienes suficientes puntos.' });
    }

    // 2. Calculamos nuevos valores
    const remainingPoints = currentUser.stat_points - pointsSpent;
    
    // 3. Actualizamos en Base de Datos
    await pool.query(
      'UPDATE players SET stats = $1, stat_points = $2 WHERE id = $3',
      [newStats, remainingPoints, userId]
    );

    // 4. OBTENER EL USUARIO COMPLETO ACTUALIZADO PARA ENVIARLO AL FRONTEND
    const finalUserQuery = `
      SELECT p.*, b.image_url as active_background_url
      FROM players p
      LEFT JOIN backgrounds b ON p.active_background_id = b.id
      WHERE p.id = $1
    `;
    const finalUserResult = await pool.query(finalUserQuery, [userId]);
    const finalUser = finalUserResult.rows[0];

    // Recuperamos también el inventario para no perderlo en el estado del frontend
    const itemsQuery = `
      SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.base_stats, it.description 
      FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1
    `;
    const itemsResult = await pool.query(itemsQuery, [userId]);
    finalUser.real_inventory = itemsResult.rows;

    // Recuperamos las bolsas activas (para que no se pierdan al actualizar stats)
    const bagsRes = await pool.query(
      'SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()',
      [userId]
    );
    finalUser.rented_bags = bagsRes.rows;

    // 5. RESPONDER CON ÉXITO Y DATOS NUEVOS
    res.json({ success: true, user: finalUser });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al entrenar' });
  }
};

// ALQUILAR O EXTENDER MOCHILA
exports.rentBag = async (req, res) => {
  const { userId, bagNumber } = req.body;
  const COST = 50; 
  const DAYS = 7; 

  try {
    // 1. Verificar saldo
    const userRes = await pool.query('SELECT onix FROM players WHERE id = $1', [userId]);
    const userOnix = userRes.rows[0].onix;

    if (userOnix < COST) {
      return res.status(400).json({ message: 'No tienes suficiente Ónix (Necesitas 50).' });
    }

    // 2. CÁLCULO INTELIGENTE DE FECHA (Stacking)
    // Verificamos si ya tiene un alquiler activo para esa bolsa
    const rentalCheck = await pool.query(
        'SELECT expires_at FROM player_bag_rentals WHERE player_id = $1 AND bag_number = $2',
        [userId, bagNumber]
    );

    let baseDate = new Date(); // Por defecto, empieza a contar desde hoy
    
    if (rentalCheck.rows.length > 0) {
        const currentExpiry = new Date(rentalCheck.rows[0].expires_at);
        // Si la fecha de expiración es futura, la usamos como base. Si ya pasó, usamos hoy.
        if (currentExpiry > baseDate) {
            baseDate = currentExpiry;
        }
    }

    // Sumamos los días a la fecha base
    const newExpiryDate = new Date(baseDate);
    newExpiryDate.setDate(newExpiryDate.getDate() + DAYS);

    // 3. TRANSACCIÓN
    await pool.query('BEGIN');
    
    // Cobrar
    await pool.query('UPDATE players SET onix = onix - $1 WHERE id = $2', [COST, userId]);
    
    // Guardar fecha nueva (Upsert)
    await pool.query(
      `INSERT INTO player_bag_rentals (player_id, bag_number, expires_at) 
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, bag_number) 
       DO UPDATE SET expires_at = $3`,
      [userId, bagNumber, newExpiryDate]
    );

    await pool.query('COMMIT');

    // 4. Devolver datos actualizados
    const finalUserRes = await pool.query(
      `SELECT p.*, b.image_url as active_background_url
       FROM players p
       LEFT JOIN backgrounds b ON p.active_background_id = b.id
       WHERE p.id = $1`, 
      [userId]
    );
    const updatedUser = finalUserRes.rows[0];

    const itemsQuery = `
      SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.base_stats, it.description 
      FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1
    `;
    const itemsResult = await pool.query(itemsQuery, [userId]);
    updatedUser.real_inventory = itemsResult.rows;

    // Recuperamos las bolsas con las nuevas fechas
    const bagsRes = await pool.query(
      'SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()',
      [userId]
    );
    updatedUser.rented_bags = bagsRes.rows;

    res.json({ success: true, user: updatedUser, message: `¡Bolsa ${bagNumber} extendida exitosamente!` });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Error al alquilar bolsa' });
  }
};