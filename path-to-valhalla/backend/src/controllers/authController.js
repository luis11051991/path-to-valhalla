const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'valhalla_secret_key_odin';

// MAPEO: Nombre de la raza (que viene del frontend) -> ID del Fondo (Base de Datos)
const RACE_BACKGROUNDS = {
  'human': 1,
  'elf': 2,
  'dwarf': 3,
  'orc': 4,
  'feline': 5,
  'goblin': 6
};

// --- REGISTRO ---
exports.register = async (req, res) => {
  const { username, email, password, race } = req.body; 
  const safeEmail = email.toLowerCase();

  try {
    const userCheck = await pool.query('SELECT * FROM players WHERE email = $1 OR username = $2', [safeEmail, username]);
    if (userCheck.rows.length > 0) return res.status(400).json({ message: 'Nombre o correo ya existen.' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 1. DETERMINAR FONDO INICIAL
    const raceKey = race ? race.toLowerCase() : 'human';
    const startingBgId = RACE_BACKGROUNDS[raceKey] || 1;

    // 2. CREAR JUGADOR
    const newUser = await pool.query(
      `INSERT INTO players (username, email, password_hash, race, silver, copper, current_hp, last_regen_at, active_background_id) 
       VALUES ($1, $2, $3, $4, 10, 50, 100, NOW(), $5) RETURNING *`, 
      [username, safeEmail, hash, raceKey, startingBgId]
    );
    const user = newUser.rows[0];

    // 3. DAR PROPIEDAD DEL FONDO
    await pool.query('INSERT INTO player_backgrounds (player_id, background_id) VALUES ($1, $2)', [user.id, startingBgId]);

    // 4. OBTENER URL DEL FONDO
    const bgResult = await pool.query('SELECT image_url FROM backgrounds WHERE id = $1', [startingBgId]);
    const bgUrl = bgResult.rows[0]?.image_url || '';

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.status(201).json({ 
      message: '¡Bienvenido!', 
      token,
      user: { 
        ...user, 
        active_background_url: bgUrl, 
        real_inventory: [],
        rented_bags: [] // Usuario nuevo no tiene bolsas alquiladas aún
      } 
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Error Server' }); }
};

// --- LOGIN ---
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const safeEmail = email.toLowerCase(); 

  try {
    // 1. Buscar usuario
    const result = await pool.query('SELECT * FROM players WHERE email = $1', [safeEmail]);
    if (result.rows.length === 0) return res.status(400).json({ message: 'Guerrero no encontrado.' });

    let user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Credenciales incorrectas.' });

    // 2. Regeneración de vida
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

    // 3. Inventario
    const itemsQuery = `
      SELECT pi.*, it.name, it.type, it.slot, it.rarity, it.icon, it.base_stats, it.description 
      FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1
    `;
    const itemsResult = await pool.query(itemsQuery, [user.id]);

    // 4. Fondo Activo
    const bgId = user.active_background_id || 1;
    const bgQuery = `SELECT image_url FROM backgrounds WHERE id = $1`;
    const bgResult = await pool.query(bgQuery, [bgId]);
    const bgUrl = bgResult.rows.length > 0 ? bgResult.rows[0].image_url : '';

    // 5. BOLSAS ALQUILADAS (MODIFICADO PARA TRAER FECHA)
    const bagsQuery = `SELECT bag_number, expires_at FROM player_bag_rentals WHERE player_id = $1 AND expires_at > NOW()`;
    const bagsResult = await pool.query(bagsQuery, [user.id]);
    // Ahora enviamos el objeto completo, no solo el número
    const rentedBags = bagsResult.rows;

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '7d' });

    res.json({ 
      message: 'Regreso glorioso.',
      token, 
      user: { 
        ...user,
        real_inventory: itemsResult.rows,
        active_background_url: bgUrl,
        rented_bags: rentedBags // <--- Enviamos esto al frontend
      } 
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Error Server' }); }
};