const pool = require('../config/db');

// 1. OBTENER LISTA (Catálogo + Propiedad)
exports.getBackgrounds = async (req, res) => {
  const { userId } = req.query; // Recibimos el ID del jugador

  try {
    // Esta consulta maestra trae todos los fondos y una columna extra "owned" (true/false)
    // Si el jugador lo tiene en player_backgrounds, owned será true.
    const query = `
      SELECT b.*, 
      CASE WHEN pb.id IS NOT NULL THEN true ELSE false END as owned
      FROM backgrounds b
      LEFT JOIN player_backgrounds pb ON b.id = pb.background_id AND pb.player_id = $1
      ORDER BY b.id ASC
    `;
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al cargar fondos' });
  }
};

// 2. EQUIPAR FONDO
exports.equipBackground = async (req, res) => {
  const { userId, backgroundId } = req.body;

  try {
    // Verificamos que realmente lo tenga comprado (Seguridad Anti-Hack)
    const check = await pool.query(
      'SELECT * FROM player_backgrounds WHERE player_id = $1 AND background_id = $2',
      [userId, backgroundId]
    );

    if (check.rows.length === 0) {
      return res.status(403).json({ message: 'No posees este fondo.' });
    }

    // Actualizamos el perfil
    await pool.query('UPDATE players SET active_background_id = $1 WHERE id = $2', [backgroundId, userId]);
    
    // Devolvemos la nueva URL para que el frontend se actualice solo
    const bgData = await pool.query('SELECT image_url FROM backgrounds WHERE id = $1', [backgroundId]);
    
    res.json({ success: true, newUrl: bgData.rows[0].image_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al equipar' });
  }
};

// 3. COMPRAR FONDO
exports.buyBackground = async (req, res) => {
  const { userId, backgroundId } = req.body;

  try {
    // Obtener precio del fondo
    const bgRes = await pool.query('SELECT price_onyx FROM backgrounds WHERE id = $1', [backgroundId]);
    const price = bgRes.rows[0].price_onyx;

    // Obtener onix del usuario
    const userRes = await pool.query('SELECT onix FROM players WHERE id = $1', [userId]);
    const userOnix = userRes.rows[0].onix;

    if (userOnix < price) {
      return res.status(400).json({ message: 'No tienes suficiente Ónix.' });
    }

    // TRANSACCIÓN: Restar dinero y Dar producto
    await pool.query('BEGIN');
    await pool.query('UPDATE players SET onix = onix - $1 WHERE id = $2', [price, userId]);
    await pool.query('INSERT INTO player_backgrounds (player_id, background_id) VALUES ($1, $2)', [userId, backgroundId]);
    await pool.query('COMMIT');

    res.json({ success: true, message: '¡Compra exitosa!' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Error en la compra' });
  }
};