const pool = require('../config/db');

const HP_REGEN_AMOUNT = 1;
const HP_REGEN_EVERY_SECONDS = 3;

const normalizeStats = (stats) => {
    if (!stats) return {};
    if (typeof stats === 'string') {
        try { return JSON.parse(stats); } catch (e) { return {}; }
    }
    return stats;
};

const addStats = (target, source) => {
    if (!source) return;
    Object.entries(source).forEach(([key, val]) => {
        const numeric = Array.isArray(val)
            ? Math.floor((Number(val[0]) + Number(val[1])) / 2)
            : Number(val);
        if (Number.isNaN(numeric)) return;
        target[key] = (target[key] || 0) + numeric;
    });
};

// Suma stats base + bonus de items equipados + bonus de mascota activa
const computeTotalStats = ({ baseStats = {}, equippedItems = [], petBonuses = {} }) => {
    const total = { ...normalizeStats(baseStats) };
    equippedItems.forEach((statObj) => addStats(total, statObj || {}));
    addStats(total, petBonuses || {});
    return total;
};

const computeMaxHp = (totalConstitution = 0) => {
    const con = Number(totalConstitution) || 0;
    return con * 20;
};

const applyHpRegen = ({ currentHp = 0, maxHp = 0, lastRegenAt, now = new Date() }) => {
    const last = lastRegenAt ? new Date(lastRegenAt) : new Date(now);
    const diffSeconds = Math.max(0, Math.floor((now - last) / 1000));
    const ticks = Math.floor(diffSeconds / HP_REGEN_EVERY_SECONDS);

    let updatedHp = Math.min(currentHp, maxHp);
    let updatedLast = last;

    if (ticks > 0) {
        updatedHp = Math.min(maxHp, updatedHp + (ticks * HP_REGEN_AMOUNT));
        updatedLast = new Date(last.getTime() + (ticks * HP_REGEN_EVERY_SECONDS * 1000));
    }

    updatedHp = Math.min(updatedHp, maxHp);
    return { currentHp: updatedHp, lastRegenAt: updatedLast };
};

const getDb = (client) => client || pool;

const getEquippedStats = async (playerId, client) => {
    const db = getDb(client);
    const res = await db.query(
        `SELECT COALESCE(pi.base_stats, it.base_stats) AS stats
         FROM player_items pi
         JOIN items_templates it ON pi.template_id = it.id
         WHERE pi.player_id = $1 AND pi.is_equipped = true`,
        [playerId]
    );
    return res.rows.map((row) => normalizeStats(row.stats));
};

const getActivePetBonuses = async (playerId, client) => {
    const db = getDb(client);
    const res = await db.query(
        `SELECT p.bonus_stats 
         FROM player_pets pp 
         JOIN pets p ON pp.pet_id = p.id 
         WHERE pp.player_id = $1 AND pp.is_active = true AND pp.current_hunger > 0 
         LIMIT 1`,
        [playerId]
    );
    return normalizeStats(res.rows[0]?.bonus_stats);
};

// Carga jugador + equipo + mascota, calcula stats derivados, aplica regen y clamp de HP
const hydratePlayer = async (userOrId, client) => {
    const db = getDb(client);
    let basePlayer;

    if (userOrId && typeof userOrId === 'object') {
        basePlayer = { ...userOrId };
    } else {
        const res = await db.query('SELECT * FROM players WHERE id = $1', [userOrId]);
        if (res.rows.length === 0) throw new Error('Jugador no encontrado');
        basePlayer = res.rows[0];
    }

    const equippedStats = await getEquippedStats(basePlayer.id, db);
    const petBonuses = await getActivePetBonuses(basePlayer.id, db);

    const totalStats = computeTotalStats({
        baseStats: basePlayer.stats,
        equippedItems: equippedStats,
        petBonuses
    });

    const maxHp = computeMaxHp(totalStats.constitution || 0);
    const regenResult = applyHpRegen({
        currentHp: Number(basePlayer.current_hp) || 0,
        maxHp,
        lastRegenAt: basePlayer.last_regen_at,
        now: new Date()
    });

    let currentHp = regenResult.currentHp;
    const lastRegenAt = regenResult.lastRegenAt;

    // Clamp si el máximo bajó por quitar equipo/mascota
    if (currentHp > maxHp) currentHp = maxHp;

    const lastPersisted = basePlayer.last_regen_at ? new Date(basePlayer.last_regen_at).getTime() : null;
    const lastComputed = lastRegenAt ? new Date(lastRegenAt).getTime() : null;
    const needsUpdate = currentHp !== basePlayer.current_hp || (lastComputed && lastComputed !== lastPersisted);

    if (needsUpdate) {
        await db.query(
            'UPDATE players SET current_hp = $1, last_regen_at = $2 WHERE id = $3',
            [currentHp, lastRegenAt, basePlayer.id]
        );
    }

    return {
        ...basePlayer,
        stats: normalizeStats(basePlayer.stats),
        current_hp: currentHp,
        last_regen_at: lastRegenAt,
        calculatedMaxHp: maxHp,
        calculated_max_hp: maxHp,
        total_stats: totalStats
    };
};

module.exports = {
    HP_REGEN_AMOUNT,
    HP_REGEN_EVERY_SECONDS,
    computeTotalStats,
    computeMaxHp,
    applyHpRegen,
    hydratePlayer
};
