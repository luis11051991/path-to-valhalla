const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'valhalla_secret_key_odin';

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
    // Al registrarse, aún no ha elegido raza. Ponemos "Humano" (ID 1) temporalmente.
    // Esto es vital para que la base de datos no rechace el insert por falta de datos.
    const defaultRace = 'human';
    const defaultGender = 'male';
    const defaultClassId = 1; // Novicio Humano
    const defaultBgId = 1;    // Fondo Humano
    const defaultStats = JSON.stringify({ strength: 5, dexterity: 5, constitution: 5, intelligence: 5, luck: 5, charisma: 5 });

    // 4. INSERTAR JUGADOR
    const insertQuery = `
       INSERT INTO players 
       (username, email, password_hash, race, gender, silver, copper, current_hp, last_regen_at, active_background_id, class_id, stats) 
       VALUES ($1, $2, $3, $4, $5, 10, 50, 100, NOW(), $6, $7, $8) 
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
    
    const user = newUser.rows[0];

    // 5. REGISTRAR FONDO INICIAL (Para que no de error al cargar perfil)
    await pool.query('INSERT INTO player_backgrounds (player_id, background_id) VALUES ($1, $2)', [user.id, defaultBgId]);
    
    // Obtener URL del fondo
    const bgResult = await pool.query('SELECT image_url FROM backgrounds WHERE id = $1', [defaultBgId]);
    const bgUrl = bgResult.rows[0]?.image_url || '';

    // 6. GENERAR TOKEN
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    // 7. RESPONDER ÉXITO
    res.status(201).json({ 
      message: '¡Cuenta creada! Elige tu destino.', 
      token,
      user: { ...user, active_background_url: bgUrl, real_inventory: [], rented_bags: [] } 
    });

  } catch (err) { 
      console.error(">>> ERROR CRÍTICO EN REGISTER:", err); 
      // Devolvemos JSON de error, NO TEXTO, para que el frontend no explote con JSON.parse
      res.status(500).json({ message: 'Error interno del servidor. Revisa la consola del backend.' }); 
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

    // Regeneración offline
    const now = new Date();
    const lastRegen = user.last_regen_at ? new Date(user.last_regen_at) : new Date();
    const con = (user.stats && user.stats.constitution) ? user.stats.constitution : 10;
    const maxHp = 100 + (con * 20); 
    const diffSeconds = Math.floor((now - lastRegen) / 1000);
    const hpToHeal = Math.floor(diffSeconds / 6); 

    if (hpToHeal > 0 && user.current_hp < maxHp) {
        const newHp = Math.min(user.current_hp + hpToHeal, maxHp);
        await pool.query('UPDATE players SET current_hp = $1, last_regen_at = NOW() WHERE id = $2', [newHp, user.id]);
        user.current_hp = newHp;
    }

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
    const user = result.rows[0];

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