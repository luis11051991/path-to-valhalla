const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'valhalla_secret_key_odin';

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  const safeEmail = email.toLowerCase(); // Normalización

  try {
    const userCheck = await pool.query('SELECT * FROM players WHERE email = $1 OR username = $2', [safeEmail, username]);
    if (userCheck.rows.length > 0) return res.status(400).json({ message: 'Nombre o correo ya existen.' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `INSERT INTO players (username, email, password_hash, silver, copper) 
       VALUES ($1, $2, $3, 10, 50) RETURNING *`, 
      [username, safeEmail, hash]
    );
    const user = newUser.rows[0];
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.status(201).json({ 
      message: '¡Bienvenido!', 
      token,
      user: { 
        id: user.id, username: user.username, level: user.level,
        race: user.race, class_path: user.class_path,
        gold: user.gold, silver: user.silver, copper: user.copper,
        energy: user.energy, valor: user.valor,
        // --- AGREGA ESTO ---
        stats: user.stats,       // <--- Vital para ver Fuerza, Destreza, etc.
        stat_points: user.stat_points || 0,
        inventory: user.inventory, // <--- Vital para el futuro
        equipment: user.equipment  // <--- Vital para el futuro
      }
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Error Server' }); }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const safeEmail = email.toLowerCase(); 

  try {
    const result = await pool.query('SELECT * FROM players WHERE email = $1', [safeEmail]);
    if (result.rows.length === 0) return res.status(400).json({ message: 'Guerrero no encontrado.' });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Credenciales incorrectas.' });

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.json({ 
      message: 'Regreso glorioso.',
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        level: user.level,
        race: user.race, 
        class_path: user.class_path,
        gold: user.gold, 
        silver: user.silver, 
        copper: user.copper,
        energy: user.energy, 
        valor: user.valor,
        
        // --- AQUÍ ESTÁN TUS STATS ---
        stats: user.stats,
        stat_points: user.stat_points, // <--- ¡ESTA ES LA LÍNEA QUE FALTABA!
        
        inventory: user.inventory,
        equipment: user.equipment
      } 
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Error Server' }); }
};