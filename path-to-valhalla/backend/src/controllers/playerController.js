const pool = require('../config/db');

exports.chooseRace = async (req, res) => {
  const { userId, race } = req.body;

  try {
    // Actualizamos la raza en la base de datos
    // También regalamos un título inicial dependiendo de la raza para que empiece con estilo
    const query = `
      UPDATE players 
      SET race = $1, 
          class_path = 'novice' 
      WHERE id = $2 
      RETURNING *
    `;
    
    const result = await pool.query(query, [race, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Jugador no encontrado' });
    }

    res.json({ 
      message: 'Linaje aceptado', 
      user: result.rows[0] 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al forjar el destino' });
  }
};