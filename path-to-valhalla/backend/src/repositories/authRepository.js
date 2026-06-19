const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { hydratePlayer } = require('../shared/player_stats');

exports.createUser = async ({ username, email, password }) => {
  const safeEmail = email.toLowerCase();

  const existing = await pool.query(
    'SELECT 1 FROM players WHERE email = $1 OR username = $2 LIMIT 1',
    [safeEmail, username]
  );
  if (existing.rows.length > 0) return { error: 'duplicate_user' };

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  const result = await pool.query(
    `INSERT INTO players 
     (username, email, password_hash, race, gender, silver, copper, current_hp, energy, valor, last_regen_at, active_background_id, class_id, stats) 
     VALUES ($1, $2, $3, $4, $5, 10, 50, 100, 100, 5, NOW(), $6, $7, $8) 
     RETURNING *`,
    [username, safeEmail, hash, 'human', 'male', 1, 1, JSON.stringify({ strength: 5, dexterity: 5, constitution: 5, intelligence: 5, luck: 5, charisma: 5 })]
  );

  const user = result.rows[0];

  await pool.query('INSERT INTO player_backgrounds (player_id, background_id) VALUES ($1, $2)', [user.id, 1]);

  const bgResult = await pool.query('SELECT image_url FROM backgrounds WHERE id = $1', [1]);
  user.active_background_url = bgResult.rows[0]?.image_url || '';

  const hydrated = await hydratePlayer(user.id);
  return { ...hydrated, active_background_url: user.active_background_url };
};

exports.findUserByEmail = async (email) => {
  const result = await pool.query(
    `SELECT p.*, c.image_url as class_image, c.name as class_name 
     FROM players p 
     LEFT JOIN classes c ON p.class_id = c.id 
     WHERE p.email = $1`,
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
};

exports.findUserById = async (userId) => {
  const result = await pool.query(
    `SELECT p.*, c.image_url as class_image, c.name as class_name 
     FROM players p 
     LEFT JOIN classes c ON p.class_id = c.id 
     WHERE p.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

exports.verifyPassword = async (passwordHash, password) => {
  return bcrypt.compare(password, passwordHash);
};
