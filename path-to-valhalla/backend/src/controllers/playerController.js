const pool = require('../config/db');

// Definimos los stats base aquí (o podrías importarlos si compartieras archivo, pero por seguridad mejor aquí)
const RACE_STATS = {
  human:  { strength: 5, dexterity: 5, constitution: 5, intelligence: 5, charisma: 7, luck: 5 },
  elf:    { strength: 4, dexterity: 7, constitution: 4, intelligence: 6, charisma: 5, luck: 5 },
  dwarf:  { strength: 6, dexterity: 3, constitution: 8, intelligence: 4, charisma: 4, luck: 5 },
  goblin: { strength: 3, dexterity: 8, constitution: 3, intelligence: 7, charisma: 3, luck: 8 },
  orc:    { strength: 9, dexterity: 4, constitution: 6, intelligence: 2, charisma: 3, luck: 3 },
  feline: { strength: 5, dexterity: 8, constitution: 4, intelligence: 4, charisma: 4, luck: 5 }
};

exports.chooseRace = async (req, res) => {
  const { userId, race } = req.body;

  try {
    // 1. Obtener los stats correspondientes a la raza elegida
    const startingStats = RACE_STATS[race];

    if (!startingStats) {
      return res.status(400).json({ message: 'Raza inválida' });
    }

    // 2. Actualizar raza, clase Y LOS STATS en la base de datos
    const query = `
      UPDATE players 
      SET race = $1, 
          class_path = 'novice',
          stats = $2::jsonb 
      WHERE id = $3 
      RETURNING *
    `;
    
    // Convertimos el objeto de stats a string JSON para guardarlo
    const result = await pool.query(query, [race, JSON.stringify(startingStats), userId]);

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

exports.trainStats = async (req, res) => {
  const { userId, newStats, pointsSpent } = req.body;

  try {
    // 1. Buscamos al jugador actual para validar
    const playerResult = await pool.query('SELECT * FROM players WHERE id = $1', [userId]);
    const player = playerResult.rows[0];

    if (!player) return res.status(404).json({ message: 'Jugador no encontrado' });

    // 2. Validación de Seguridad (Anti-Trampas)
    // El jugador no puede gastar más puntos de los que tiene
    if (pointsSpent > player.stat_points) {
      return res.status(400).json({ message: 'No tienes suficientes puntos de atributo.' });
    }

    // 3. Actualizamos: Guardamos los nuevos stats y restamos los puntos gastados
    const updateQuery = `
      UPDATE players 
      SET stats = $1::jsonb, 
          stat_points = stat_points - $2 
      WHERE id = $3 
      RETURNING stats, stat_points
    `;

    const result = await pool.query(updateQuery, [JSON.stringify(newStats), pointsSpent, userId]);

    res.json({ 
      message: 'Entrenamiento completado.', 
      stats: result.rows[0].stats,
      stat_points: result.rows[0].stat_points
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al entrenar.' });
  }
};