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
    if (userCheck.rows.length > 0) return res.status(400).json({ message: 'Ya existe ese usuario.' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `INSERT INTO players (username, email, password_hash, silver, copper, current_hp, last_regen_at) 
       VALUES ($1, $2, $3, 10, 50, 100, NOW()) RETURNING *`, 
      [username, safeEmail, hash]
    );
    const user = newUser.rows[0];
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.status(201).json({ 
      message: '¡Bienvenido!', 
      token,
      user: { ...user, real_inventory: [] } 
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Error Server' }); }
};

// --- LOGIN ---
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const safeEmail = email.toLowerCase(); 

  try {
    const result = await pool.query('SELECT * FROM players WHERE email = $1', [safeEmail]);
    if (result.rows.length === 0) return res.status(400).json({ message: 'Usuario no encontrado.' });

    let user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Contraseña incorrecta.' });

    // 1. REGENERACIÓN DE VIDA (Lazy Calculation)
    const now = new Date();
    const lastRegen = user.last_regen_at ? new Date(user.last_regen_at) : new Date();
    const maxHp = (user.stats.constitution || 10) * 20;
    const diffSeconds = Math.floor((now - lastRegen) / 1000);
    const hpToHeal = Math.floor(diffSeconds / 30); // 1 HP cada 30 seg

    if (hpToHeal > 0 && user.current_hp < maxHp) {
        const newHp = Math.min(user.current_hp + hpToHeal, maxHp);
        await pool.query('UPDATE players SET current_hp = $1, last_regen_at = NOW() WHERE id = $2', [newHp, user.id]);
        user.current_hp = newHp;
    }

    // 2. OBTENER INVENTARIO REAL
    const itemsQuery = `
      SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.base_stats, it.description
      FROM player_items pi
      JOIN items_templates it ON pi.template_id = it.id
      WHERE pi.player_id = $1
    `;
    const itemsResult = await pool.query(itemsQuery, [user.id]);

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.json({ 
      message: 'Login exitoso.',
      token, 
      user: { 
        ...user,
        real_inventory: itemsResult.rows // <--- ESTO ES LO IMPORTANTE
      } 
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Error Server' }); }
};