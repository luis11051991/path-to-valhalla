const pool = require('../config/db');

const POWER_SQL = `FLOOR(
  GREATEST(COALESCE((stats->>'strength')::int, 0), 0) * 4 +
  GREATEST(COALESCE((stats->>'dexterity')::int, 0), 0) * 3 +
  GREATEST(COALESCE((stats->>'constitution')::int, 0), 0) * 4 +
  GREATEST(COALESCE((stats->>'intelligence')::int, 0), 0) * 3 +
  GREATEST(COALESCE((stats->>'luck')::int, 0), 0) * 2 +
  GREATEST(COALESCE((stats->>'charisma')::int, 0), 0) * 1.5
)::int + level * 25`;

async function getHeroRankings({ page = 1, limit = 20, search = '' }) {
  const offset = (page - 1) * limit;

  if (search) {
    const searchPattern = `%${search}%`;
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM players p WHERE p.username ILIKE $1`,
      [searchPattern]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT p.id, p.username, p.level, c.name AS class_name, p.race,
              ${POWER_SQL} AS power
       FROM players p
       LEFT JOIN classes c ON c.id = p.class_id
       WHERE p.username ILIKE $3
       ORDER BY power DESC, p.level DESC, p.id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset, searchPattern]
    );

    return {
      data: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  const countResult = await pool.query('SELECT COUNT(*) FROM players p');
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT p.id, p.username, p.level, c.name AS class_name, p.race,
            ${POWER_SQL} AS power
     FROM players p
     LEFT JOIN classes c ON c.id = p.class_id
     ORDER BY power DESC, p.level DESC, p.id ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return {
    data: result.rows,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

async function getAllianceRankings({ page = 1, limit = 20, search = '' }) {
  const offset = (page - 1) * limit;

  if (search) {
    const searchPattern = `%${search}%`;
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM alliances a WHERE a.name ILIKE $1`,
      [searchPattern]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT a.id, a.name, a.tag, a.logo_url, a.description,
              COALESCE(am.members_count, 0) AS members_count,
              COALESCE(ap.total_power, 0) AS total_power,
              COALESCE(ab.buildings_score, 0) AS buildings_score
       FROM alliances a
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS members_count FROM alliance_members WHERE alliance_id = a.id AND is_active = true
       ) am ON true
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(${POWER_SQL}), 0) AS total_power
         FROM players p
         WHERE p.id IN (SELECT player_id FROM alliance_members WHERE alliance_id = a.id AND is_active = true)
       ) ap ON true
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(level), 0) AS buildings_score
         FROM alliance_buildings WHERE alliance_id = a.id
       ) ab ON true
       WHERE a.name ILIKE $3
       ORDER BY total_power DESC, members_count DESC, a.name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset, searchPattern]
    );

    return {
      data: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  const countResult = await pool.query('SELECT COUNT(*) FROM alliances a');
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT a.id, a.name, a.tag, a.logo_url, a.description,
            COALESCE(am.members_count, 0) AS members_count,
            COALESCE(ap.total_power, 0) AS total_power,
            COALESCE(ab.buildings_score, 0) AS buildings_score
     FROM alliances a
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS members_count FROM alliance_members WHERE alliance_id = a.id AND is_active = true
     ) am ON true
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(${POWER_SQL}), 0) AS total_power
       FROM players p
       WHERE p.id IN (SELECT player_id FROM alliance_members WHERE alliance_id = a.id AND is_active = true)
     ) ap ON true
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(level), 0) AS buildings_score
       FROM alliance_buildings WHERE alliance_id = a.id
     ) ab ON true
     ORDER BY total_power DESC, members_count DESC, a.name ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return {
    data: result.rows,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

module.exports = { getHeroRankings, getAllianceRankings };
