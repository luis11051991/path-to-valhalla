const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'valhalla_secret_key_odin';

// --- REGISTRO ---
exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  const safeEmail = email.toLowerCase();

  try {
    const userCheck = await pool.query('SELECT * FROM players WHERE email = $1 OR username = $2', [safeEmail, username]);
    if (userCheck.rows.length > 0) return res.status(400).json({ message: 'Usuario ya existe.' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 1. Crear Jugador (Con fondo ID 1 por defecto)
    const newUser = await pool.query(
      `INSERT INTO players (username, email, password_hash, silver, copper, current_hp, last_regen_at, active_background_id) 
       VALUES ($1, $2, $3, 10, 50, 100, NOW(), 1) RETURNING *`, 
      [username, safeEmail, hash]
    );
    const user = newUser.rows[0];

    // 2. Darle propiedad del fondo default (Insertar en player_backgrounds)
    await pool.query('INSERT INTO player_backgrounds (player_id, background_id) VALUES ($1, 1)', [user.id]);

    // 3. Buscar la URL del fondo para enviarla al frontend
    const bgResult = await pool.query('SELECT image_url FROM backgrounds WHERE id = 1');
    const bgUrl = bgResult.rows[0].image_url;

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.status(201).json({ 
      message: '¡Bienvenido!', 
      token,
      user: { 
        ...user, 
        active_background_url: bgUrl, // Enviamos la URL resuelta
        real_inventory: [] 
      }
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Error Server' }); }
};

// --- LOGIN ---
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const safeEmail = email.toLowerCase(); 

  try {
    // 1. Buscar Usuario
    const result = await pool.query('SELECT * FROM players WHERE email = $1', [safeEmail]);
    if (result.rows.length === 0) return res.status(400).json({ message: 'No encontrado.' });

    let user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Credenciales incorrectas.' });

    // 2. Regeneración de Vida
    const now = new Date();
    const lastRegen = user.last_regen_at ? new Date(user.last_regen_at) : new Date();
    const maxHp = (user.stats.constitution || 10) * 20;
    const diffSeconds = Math.floor((now - lastRegen) / 1000);
    const hpToHeal = Math.floor(diffSeconds / 30);

    if (hpToHeal > 0 && user.current_hp < maxHp) {
        const newHp = Math.min(user.current_hp + hpToHeal, maxHp);
        await pool.query('UPDATE players SET current_hp = $1, last_regen_at = NOW() WHERE id = $2', [newHp, user.id]);
        user.current_hp = newHp;
    }

    // 3. Obtener Inventario
    const itemsQuery = `
      SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.base_stats, it.description 
      FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1
    `;
    const itemsResult = await pool.query(itemsQuery, [user.id]);

    // 4. OBTENER URL DEL FONDO (JOIN)
    // Buscamos la URL en la tabla backgrounds usando el ID que tiene el jugador
    const bgQuery = `SELECT image_url FROM backgrounds WHERE id = $1`;
    const bgResult = await pool.query(bgQuery, [user.active_background_id || 1]); // Fallback al 1 si es null
    const bgUrl = bgResult.rows.length > 0 ? bgResult.rows[0].image_url : '';

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.json({ 
      message: 'Regreso glorioso.',
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        level: user.level,
        experience: user.experience, 
        current_hp: user.current_hp,
        race: user.race, 
        class_path: user.class_path,
        gold: user.gold, silver: user.silver, copper: user.copper, onix: user.onix,
        energy: user.energy, valor: user.valor,
        stats: user.stats,
        stat_points: user.stat_points,
        
        real_inventory: itemsResult.rows,
        active_background_url: bgUrl // <--- Aquí va la URL para el Frontend
      } 
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Error Server' }); }
};