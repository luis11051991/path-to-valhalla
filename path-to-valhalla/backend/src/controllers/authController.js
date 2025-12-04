const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// En producción, esto iría en .env
const SECRET_KEY = 'valhalla_secret_key_odin';

// Función auxiliar para convertir todo a cobre (útil para restas futuras)
// Ejemplo: 1 Oro, 50 Plata = 15000 Cobre
const convertToCopper = (gold, silver, copper) => {
  return (BigInt(gold) * 10000n) + (BigInt(silver) * 100n) + BigInt(copper);
};

exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    // 1. Validar existencia
    const userCheck = await pool.query('SELECT * FROM players WHERE email = $1 OR username = $2', [email, username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Ese nombre o correo ya está inscrito en el libro de los destinos.' });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 3. Crear Jugador
    // NOTA: Le damos 10 de Plata y 50 de Cobre iniciales para que el inventario no se vea triste.
    const newUserQuery = `
      INSERT INTO players (username, email, password_hash, silver, copper)
      VALUES ($1, $2, $3, 10, 50)
      RETURNING id, username, level, gold, silver, copper, energy, valor
    `;
    
    const newUser = await pool.query(newUserQuery, [username, email, hash]);
    const user = newUser.rows[0];

    // 4. Token
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.status(201).json({ 
      message: '¡Bienvenido a Path to Valhalla!', 
      token,
      user
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor al forjar el alma.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Buscar usuario
    const result = await pool.query('SELECT * FROM players WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ message: 'Guerrero no encontrado.' });

    const user = result.rows[0];

    // Verificar password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Credenciales incorrectas.' });

    // Actualizar última conexión
    await pool.query('UPDATE players SET last_login = NOW() WHERE id = $1', [user.id]);

    // Token
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    // Enviamos al Frontend los datos que necesita para la UI
    res.json({ 
      message: 'Regreso glorioso.',
      token, 
      user: { 
        id: user.id, 
        username: user.username,
        level: user.level,
        // Economía
        gold: user.gold,
        silver: user.silver,
        copper: user.copper,
        onix: user.onix,
        // Recursos
        energy: user.energy,
        valor: user.valor
      } 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'El Valhalla no responde (Error de servidor).' });
  }
};