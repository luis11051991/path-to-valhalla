const pool = require('../config/db');

const POWER_SQL = `FLOOR(
  GREATEST(COALESCE((p.stats->>'strength')::int, 0), 0) * 4 +
  GREATEST(COALESCE((p.stats->>'dexterity')::int, 0), 0) * 3 +
  GREATEST(COALESCE((p.stats->>'constitution')::int, 0), 0) * 4 +
  GREATEST(COALESCE((p.stats->>'intelligence')::int, 0), 0) * 3 +
  GREATEST(COALESCE((p.stats->>'luck')::int, 0), 0) * 2 +
  GREATEST(COALESCE((p.stats->>'charisma')::int, 0), 0) * 1.5
)::int + p.level * 25`;

async function getHeroRankings({ page = 1, limit = 20, search = '', race = '' }) {
  const offset = (page - 1) * limit;

  const wheres = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    wheres.push(`p.username ILIKE $${params.length}`);
  }
  if (race) {
    params.push(race);
    wheres.push(`p.race = $${params.length}`);
  }

  const whereClause = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM players p ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const mainWhere = wheres.length
    ? 'WHERE ' + wheres.map(w => w.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 2}`)).join(' AND ')
    : '';

  const result = await pool.query(
    `SELECT p.id, p.username, p.level, c.name AS class_name, p.race,
            a.name AS alliance_name, a.id AS alliance_id,
            ${POWER_SQL} AS power
     FROM players p
     LEFT JOIN classes c ON c.id = p.class_id
     LEFT JOIN LATERAL (
       SELECT alliance_id FROM alliance_members WHERE player_id = p.id AND is_active = true LIMIT 1
     ) amm ON true
     LEFT JOIN alliances a ON a.id = amm.alliance_id AND a.is_active = true
     ${mainWhere}
     ORDER BY power DESC, p.level DESC, p.id ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset, ...params]
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
      `SELECT COUNT(*) FROM alliances a WHERE a.is_active = true AND a.name ILIKE $1`,
      [searchPattern]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT a.id, a.name, a.tag, a.logo_url, a.description,
              a.leader_id, leader.username AS leader_name,
              COALESCE(am.members_count, 0) AS members_count,
              COALESCE(ap.total_power, 0) AS total_power,
              COALESCE(ab.buildings_score, 0) AS buildings_score
       FROM alliances a
       LEFT JOIN players leader ON leader.id = a.leader_id
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
       WHERE a.is_active = true AND a.name ILIKE $3
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

  const countResult = await pool.query('SELECT COUNT(*) FROM alliances a WHERE a.is_active = true');
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT a.id, a.name, a.tag, a.logo_url, a.description,
            a.leader_id, leader.username AS leader_name,
            COALESCE(am.members_count, 0) AS members_count,
            COALESCE(ap.total_power, 0) AS total_power,
            COALESCE(ab.buildings_score, 0) AS buildings_score
     FROM alliances a
     LEFT JOIN players leader ON leader.id = a.leader_id
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
     WHERE a.is_active = true
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
