const pool = require('../config/db');

const HP_REGEN_EVERY_SECONDS = 3;
const HP_REGEN_AMOUNT = 1;

const sumStats = (statsArray) => {
  return statsArray.reduce((acc, statObj) => {
    if (!statObj) return acc;
    Object.entries(statObj).forEach(([k, v]) => {
      acc[k] = (acc[k] || 0) + (Array.isArray(v) ? Math.floor((v[0] + v[1]) / 2) : v);
    });
    return acc;
  }, {});
};

const computeTotalStats = ({ baseStats = {}, equippedItems = [], petBonuses = {} }) => {
  const itemStats = sumStats(equippedItems.map((it) => it.base_stats || it.stats || {}));
  const total = { ...baseStats };
  Object.entries(itemStats).forEach(([k, v]) => {
    total[k] = (total[k] || 0) + v;
  });
  Object.entries(petBonuses || {}).forEach(([k, v]) => {
    total[k] = (total[k] || 0) + v;
  });
  return total;
};

const computeMaxHp = (totalConstitution = 0) => {
  return totalConstitution * 20;
};

const applyHpRegen = ({ currentHp, maxHp, lastRegenAt, now }) => {
  const last = lastRegenAt ? new Date(lastRegenAt) : now;
  const diffSeconds = Math.floor((now - last) / 1000);
  const ticks = Math.floor(diffSeconds / HP_REGEN_EVERY_SECONDS);
  const healed = ticks * HP_REGEN_AMOUNT;
  const nextHp = Math.min(maxHp, currentHp + healed);
  const nextLast = ticks > 0 ? new Date(last.getTime() + ticks * HP_REGEN_EVERY_SECONDS * 1000) : last;
  return { nextHp, nextLast };
};

const getEquippedItems = async (playerId, client = pool) => {
  const res = await client.query(
    `SELECT COALESCE(pi.base_stats, it.base_stats) AS base_stats
     FROM player_items pi 
     JOIN items_templates it ON pi.template_id = it.id 
     WHERE pi.player_id = $1 AND pi.is_equipped = true`,
    [playerId]
  );
  return res.rows || [];
};

const getActivePetBonuses = async (playerId, client = pool) => {
  const res = await client.query(
    `SELECT p.bonus_stats 
     FROM player_pets pp 
     JOIN pets p ON pp.pet_id = p.id 
     WHERE pp.player_id = $1 AND pp.is_active = true AND pp.current_hunger > 0 
     LIMIT 1`,
    [playerId]
  );
  return res.rows.length ? res.rows[0].bonus_stats || {} : {};
};

const hydratePlayer = async (userId, externalClient = null) => {
  const client = externalClient || (await pool.connect());
  const release = externalClient ? () => {} : () => client.release();

  try {
    const playerRes = await client.query('SELECT * FROM players WHERE id = $1', [userId]);
    if (playerRes.rows.length === 0) throw new Error('Jugador no encontrado');
    const player = playerRes.rows[0];

    const equippedItems = await getEquippedItems(userId, client);
    const petBonuses = await getActivePetBonuses(userId, client);
    const baseStats = player.stats || {};
    const totalStats = computeTotalStats({ baseStats, equippedItems, petBonuses });
    const maxHp = computeMaxHp(totalStats.constitution || 0);

    const now = new Date();
    const { nextHp, nextLast } = applyHpRegen({
      currentHp: Math.min(player.current_hp, maxHp),
      maxHp,
      lastRegenAt: player.last_regen_at,
      now,
    });

    if (nextHp !== player.current_hp || nextLast.toISOString() !== (player.last_regen_at && new Date(player.last_regen_at).toISOString())) {
      await client.query('UPDATE players SET current_hp = $1, last_regen_at = $2 WHERE id = $3', [
        nextHp,
        nextLast,
        userId,
      ]);
      player.current_hp = nextHp;
      player.last_regen_at = nextLast;
    } else {
      player.last_regen_at = nextLast;
    }

    player.calculatedMaxHp = maxHp;
    player.total_stats = totalStats;

    return player;
  } finally {
    release();
  }
};

module.exports = {
  computeTotalStats,
  computeMaxHp,
  applyHpRegen,
  hydratePlayer,
};
