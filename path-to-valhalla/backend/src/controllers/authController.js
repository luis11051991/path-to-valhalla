const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { hydratePlayer } = require('../shared/player_stats');

// JWT_SECRET centralizado desde config/env — misma fuente que authMiddleware y socket.js
const SECRET_KEY = env.JWT_SECRET;

// --- REGISTRO (PASO 1: CREAR CUENTA VACÍA) ---
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body; 
    
    // Validación básica
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Faltan datos obligatorios.' });
    }

    const safeEmail = email.toLowerCase();

    // 1. Validar duplicados
    const userCheck = await pool.query('SELECT * FROM players WHERE email = $1 OR username = $2', [safeEmail, username]);
    if (userCheck.rows.length > 0) {
        return res.status(400).json({ message: 'El nombre o correo ya están en uso.' });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 3. DATOS POR DEFECTO PARA PASO 1
    const defaultRace = 'human';
    const defaultGender = 'male';
    const defaultClassId = 1; // Novicio Humano
    const defaultBgId = 1;    // Fondo Humano
    const defaultStats = JSON.stringify({ strength: 5, dexterity: 5, constitution: 5, intelligence: 5, luck: 5, charisma: 5 });

    // 4. INSERTAR JUGADOR (Con last_regen_at en NOW() para iniciar el contador)
    const insertQuery = `
       INSERT INTO players 
       (username, email, password_hash, race, gender, silver, copper, current_hp, energy, valor, last_regen_at, active_background_id, class_id, stats) 
       VALUES ($1, $2, $3, $4, $5, 10, 50, 100, 100, 5, NOW(), $6, $7, $8) 
       RETURNING *
    `;
    
    const newUser = await pool.query(insertQuery, [
        username, 
        safeEmail, 
        hash, 
        defaultRace, 
        defaultGender, 
        defaultBgId, 
        defaultClassId, 
        defaultStats
    ]);
    
    let user = newUser.rows[0];

    // 5. REGISTRAR FONDO INICIAL
    await pool.query('INSERT INTO player_backgrounds (player_id, background_id) VALUES ($1, $2)', [user.id, defaultBgId]);
    
    // Obtener URL del fondo
    const bgResult = await pool.query('SELECT image_url FROM backgrounds WHERE id = $1', [defaultBgId]);
    const bgUrl = bgResult.rows[0]?.image_url || '';

    // 6. HIDRATAR Y GENERAR TOKEN
    user = await hydratePlayer(user.id);
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    // 7. RESPONDER EXITO
    res.status(201).json({ 
      message: 'Cuenta creada! Elige tu destino.', 
      token,
      user: { ...user, active_background_url: bgUrl, real_inventory: [], rented_bags: [] } 
    });
  } catch (err) { 
      console.error(">>> ERROR CRÍTICO EN REGISTER:", err); 
      res.status(500).json({ message: 'Error interno del servidor.' }); 
  }
};

// --- LOGIN ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ message: "Faltan credenciales" });

    const safeEmail = email.toLowerCase(); 

    const result = await pool.query(`
      SELECT p.*, c.image_url as class_image, c.name as class_name 
      FROM players p 
      LEFT JOIN classes c ON p.class_id = c.id 
      WHERE p.email = $1
    `, [safeEmail]);
    
    if (result.rows.length === 0) return res.status(400).json({ message: 'Guerrero no encontrado.' });

    let user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Credenciales incorrectas.' });

    // --- HIDRATACI�N Y REGEN ---
    // Calculamos regen y clamping con equipo/mascota
    user = await hydratePlayer(user);
    // ----------------------------------------------------

    // Cargar datos extra
    const itemsQuery = `
      SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, 
      it.image_url, it.price_copper, 
      it.description 
      FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1
      ORDER BY pi.bag_slot ASC
    `;
    const itemsResult = await pool.query(itemsQuery, [user.id]);

    const bgId = user.active_background_id || 1;
    const bgResult = await pool.query('SELECT image_url FROM backgrounds WHERE id = $1', [bgId]);
    const bgUrl = bgResult.rows.length > 0 ? bgResult.rows[0].image_url : '';

    const bagsResult = await pool.query('SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()', [user.id]);

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.json({ 
      message: 'Regreso glorioso.',
      token, 
      user: { 
        ...user,
        real_inventory: itemsResult.rows,
        active_background_url: bgUrl,
        rented_bags: bagsResult.rows
      } 
    });
  } catch (err) { 
      console.error(err); 
      res.status(500).json({ message: 'Error Server en Login' }); 
  }
};

// --- OBTENER PERFIL (F5) ---
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; 

    const result = await pool.query(`
      SELECT p.*, c.image_url as class_image, c.name as class_name 
      FROM players p 
      LEFT JOIN classes c ON p.class_id = c.id 
      WHERE p.id = $1
    `, [userId]);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado.' });
    
    let user = result.rows[0];

    // --- HIDRATACI�N Y REGEN ---
    // Calculamos regeneraci�n cada vez que el perfil se refresca
    user = await hydratePlayer(user);
    // -----------------------------

    const itemsQuery = `
      SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, 
      it.image_url, it.price_copper, 
      it.description 
      FROM player_items pi 
      JOIN items_templates it ON pi.template_id = it.id 
      WHERE pi.player_id = $1
      ORDER BY pi.bag_slot ASC
    `;
    const itemsResult = await pool.query(itemsQuery, [userId]);

    const bgId = user.active_background_id || 1;
    const bgResult = await pool.query('SELECT image_url FROM backgrounds WHERE id = $1', [bgId]);
    const bgUrl = bgResult.rows[0]?.image_url || '';

    const bagsResult = await pool.query('SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()', [userId]);

    res.json({ 
      user: { 
        ...user,
        real_inventory: itemsResult.rows,
        active_background_url: bgUrl,
        rented_bags: bagsResult.rows
      } 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener perfil' });
  }
};
