const pool = require('../config/db');

// Elegir Raza (Ya lo tenías, lo mantengo)
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

// ENTRENAR STATS (Aquí está el arreglo del BUG)
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
    // IMPORTANTE: También actualizamos la Vida Máxima si subió Constitución
    // Fórmula: Const * 20. Si sube const, sube HP actual proporcionalmente o se mantiene (decisión de diseño).
    // Por ahora solo actualizamos stats y puntos.
    
    await pool.query(
      'UPDATE players SET stats = $1, stat_points = $2 WHERE id = $3',
      [newStats, remainingPoints, userId]
    );

    // 4. OBTENER EL USUARIO COMPLETO ACTUALIZADO PARA ENVIARLO AL FRONTEND
    // Hacemos el JOIN para que no se pierda el inventario ni el fondo al actualizar
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

    // 5. RESPONDER CON ÉXITO Y DATOS NUEVOS
    res.json({ success: true, user: finalUser });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al entrenar' });
  }
};

// ... (Tus funciones anteriores chooseRace y trainStats siguen aquí) ...

// ALQUILAR MOCHILA (NUEVO)
exports.rentBag = async (req, res) => {
  const { userId, bagNumber } = req.body;
  const COST = 50; // Precio fijo: 50 Ónix
  const DAYS = 7;  // Duración: 7 Días

  try {
    // 1. Verificar saldo
    const userRes = await pool.query('SELECT onix FROM players WHERE id = $1', [userId]);
    const userOnix = userRes.rows[0].onix;

    if (userOnix < COST) {
      return res.status(400).json({ message: 'No tienes suficiente Ónix (Necesitas 50).' });
    }

    // 2. Calcular fecha de expiración (Ahora + 7 días)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + DAYS);

    // 3. TRANSACCIÓN: Cobrar y Dar Bolsa
    await pool.query('BEGIN');
    
    // Restar dinero
    await pool.query('UPDATE players SET onix = onix - $1 WHERE id = $2', [COST, userId]);
    
    // Insertar o Actualizar alquiler (Si ya la tenía, extendemos el tiempo)
    // Usamos ON CONFLICT para hacer un "Upsert"
    await pool.query(
      `INSERT INTO player_bag_rentals (player_id, bag_number, expires_at) 
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, bag_number) 
       DO UPDATE SET expires_at = $3`,
      [userId, bagNumber, expiryDate]
    );

    await pool.query('COMMIT');

    // 4. Devolver datos actualizados (Usuario + Lista de bolsas alquiladas)
    // Recuperamos el usuario actualizado
    const finalUserRes = await pool.query('SELECT * FROM players WHERE id = $1', [userId]);
    const updatedUser = finalUserRes.rows[0];

    // Recuperamos las bolsas activas
    const bagsRes = await pool.query(
      'SELECT bag_number FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()',
      [userId]
    );
    // Convertimos a un array simple de números: [4, 5]
    updatedUser.rented_bags = bagsRes.rows.map(row => row.bag_number);

    res.json({ success: true, user: updatedUser, message: `¡Bolsa ${bagNumber} alquilada por 7 días!` });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Error al alquilar bolsa' });
  }
};