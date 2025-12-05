const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'valhalla_secret_key_odin';

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    const userCheck = await pool.query('SELECT * FROM players WHERE email = $1 OR username = $2', [email, username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Ese nombre o correo ya están en uso.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Creamos el usuario (Por defecto Postgres le pone 'human' hasta que elija raza)
    const newUserQuery = `
      INSERT INTO players (username, email, password_hash, silver, copper)
      VALUES ($1, $2, $3, 10, 50)
      RETURNING * `; 
    // NOTA: Cambié "RETURNING id..." por "RETURNING *" para traer TODO (incluida la raza por defecto)
    
    const newUser = await pool.query(newUserQuery, [username, email, hash]);
    const user = newUser.rows[0];

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.status(201).json({ 
      message: '¡Bienvenido a Path to Valhalla!', 
      token,
      user: { 
        id: user.id, 
        username: user.username,
        level: user.level,
        race: user.race,           // <--- IMPORTANTE: Enviamos la raza
        class_path: user.class_path, // <--- IMPORTANTE: Enviamos la clase
        gold: user.gold,
        silver: user.silver,
        copper: user.copper,
        energy: user.energy,
        valor: user.valor
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor al crear personaje.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM players WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ message: 'Guerrero no encontrado.' });

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Credenciales incorrectas.' });

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    // AQUÍ ESTABA EL ERROR: FALTABA ENVIAR LA RAZA
    res.json({ 
      message: 'Regreso glorioso.',
      token, 
      user: { 
        id: user.id, 
        username: user.username,
        level: user.level,
        
        // --- ESTOS CAMPOS FALTABAN ---
        race: user.race,             // <--- ¡AHORA SÍ! El Frontend sabrá que es Goblin
        class_path: user.class_path, 
        // -----------------------------

        gold: user.gold,
        silver: user.silver,
        copper: user.copper,
        energy: user.energy,
        valor: user.valor
      } 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error de servidor.' });
  }
};