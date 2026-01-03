const pool = require('../config/db');

// --- CONSTANTES DE REGENERACIÓN ---
const HP_REGEN_AMOUNT = 1;
const HP_REGEN_EVERY_SECONDS = 3;

const ENERGY_REGEN_AMOUNT = 1;
const ENERGY_REGEN_EVERY_SECONDS = 120; // 2 minutos
const ENERGY_MAX_DEFAULT = 100;

const VALOR_REGEN_AMOUNT = 1;
const VALOR_REGEN_EVERY_SECONDS = 1800; // 30 minutos
const VALOR_MAX_DEFAULT = 5;

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

const computeTotalStats = ({ baseStats = {}, equippedItems = [], petBonuses = {} }) => {
    const total = { ...normalizeStats(baseStats) };
    equippedItems.forEach((statObj) => addStats(total, statObj || {}));
    addStats(total, petBonuses || {});
    return total;
};

const computeMaxHp = (totalConstitution = 0) => {
    const con = Number(totalConstitution) || 0;
    return 100 + (con * 20); // Fórmula base + constitución
};

// --- NUEVA LÓGICA DE REGENERACIÓN UNIFICADA ---
const applyRegen = ({ 
    currentHp = 0, maxHp = 0, 
    currentEnergy = 0, maxEnergy = 100, 
    currentValor = 0, maxValor = 5, 
    lastRegenAt, 
    now = new Date() 
}) => {
    const last = lastRegenAt ? new Date(lastRegenAt) : new Date(now);
    // Calculamos el tiempo total pasado en segundos
    const diffSeconds = Math.max(0, Math.floor((now - last) / 1000));

    // 1. Calcular Ticks para cada recurso
    const hpTicks = Math.floor(diffSeconds / HP_REGEN_EVERY_SECONDS);
    const energyTicks = Math.floor(diffSeconds / ENERGY_REGEN_EVERY_SECONDS);
    const valorTicks = Math.floor(diffSeconds / VALOR_REGEN_EVERY_SECONDS);

    // 2. Aplicar Ganancias
    let updatedHp = currentHp;
    if (hpTicks > 0 && currentHp < maxHp) {
        updatedHp = Math.min(maxHp, currentHp + (hpTicks * HP_REGEN_AMOUNT));
    }

    let updatedEnergy = currentEnergy;
    if (energyTicks > 0 && currentEnergy < maxEnergy) {
        updatedEnergy = Math.min(maxEnergy, currentEnergy + (energyTicks * ENERGY_REGEN_AMOUNT));
    }

    let updatedValor = currentValor;
    if (valorTicks > 0 && currentValor < maxValor) {
        updatedValor = Math.min(maxValor, currentValor + (valorTicks * VALOR_REGEN_AMOUNT));
    }

    // 3. Actualizar Timestamp
    // Avanzamos el reloj solo por la cantidad de "tiempo de Vida" consumido (el intervalo más corto).
    // Esto evita perder la sincronía fina, aunque implica que si refrescas cada 10 segs, 
    // la energía podría tardar un poco más en sentirse. Es el mejor compromiso con una sola columna de fecha.
    let updatedLast = last;
    if (hpTicks > 0) {
        updatedLast = new Date(last.getTime() + (hpTicks * HP_REGEN_EVERY_SECONDS * 1000));
    }

    // Si ya estamos a tope de todo, reseteamos el timer al ahora para no acumular tiempo infinito
    const isFull = updatedHp >= maxHp && updatedEnergy >= maxEnergy && updatedValor >= maxValor;
    if (isFull) {
        updatedLast = new Date(now);
    }

    return { 
        currentHp: updatedHp, 
        currentEnergy: updatedEnergy, 
        currentValor: updatedValor, 
        lastRegenAt: updatedLast 
    };
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
    
    // --- NUEVO: Usar applyRegen para todo ---
    const regenResult = applyRegen({
        currentHp: Number(basePlayer.current_hp) || 0,
        maxHp,
        currentEnergy: Number(basePlayer.energy) || 0,
        maxEnergy: ENERGY_MAX_DEFAULT, // O basePlayer.max_energy si existiera
        currentValor: Number(basePlayer.valor) || 0,
        maxValor: VALOR_MAX_DEFAULT,
        lastRegenAt: basePlayer.last_regen_at,
        now: new Date()
    });

    let currentHp = regenResult.currentHp;
    let currentEnergy = regenResult.currentEnergy;
    let currentValor = regenResult.currentValor;
    const lastRegenAt = regenResult.lastRegenAt;

    // Clamp de seguridad
    if (currentHp > maxHp) currentHp = maxHp;

    const lastPersisted = basePlayer.last_regen_at ? new Date(basePlayer.last_regen_at).getTime() : null;
    const lastComputed = lastRegenAt ? new Date(lastRegenAt).getTime() : null;
    
    // Detectar si hubo cambios en CUALQUIER stat
    const needsUpdate = 
        currentHp !== basePlayer.current_hp || 
        currentEnergy !== basePlayer.energy || 
        currentValor !== basePlayer.valor || 
        (lastComputed && lastComputed !== lastPersisted);

    if (needsUpdate) {
        // --- QUERY ACTUALIZADA: Guarda Energía y Valor ---
        await db.query(
            'UPDATE players SET current_hp = $1, energy = $2, valor = $3, last_regen_at = $4 WHERE id = $5',
            [currentHp, currentEnergy, currentValor, lastRegenAt, basePlayer.id]
        );
    }

    return {
        ...basePlayer,
        stats: normalizeStats(basePlayer.stats),
        current_hp: currentHp,
        energy: currentEnergy, // Devolvemos valor actualizado
        valor: currentValor,   // Devolvemos valor actualizado
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
    applyRegen, // Exportamos la nueva función
    hydratePlayer
};