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

const computeTotalStats = ({ baseStats = {}, equippedItems = [], petBonuses = {}, alliancePercent = 0 }) => {
    const base = normalizeStats(baseStats);
    const total = { ...base };
    equippedItems.forEach((item) => addStats(total, item.stats || item || {}));
    addStats(total, petBonuses || {});
    const pct = Number(alliancePercent) || 0;
    if (pct > 0) {
        for (const stat of CORE_STATS) {
            total[stat] = (total[stat] || 0) + Math.round((base[stat] || 0) * pct / 100);
        }
    }
    return total;
};

// ===== ALIANZA: BONUS PORCENTUAL =====
const getEffectForLevel = (levelEffects = [], level = 1) => {
    if (!Array.isArray(levelEffects)) return {};
    const exact = levelEffects.find((e) => Number(e.level) === Number(level));
    if (exact) return exact;
    const sorted = [...levelEffects]
        .filter((e) => Number(e.level) <= Number(level))
        .sort((a, b) => Number(b.level) - Number(a.level));
    return sorted[0] || {};
};

const getAllianceStatsPercent = async (playerId, client) => {
    const db = getDb(client);
    const res = await db.query(`
        SELECT ab.level, abd.level_effects
        FROM alliance_members am
        JOIN alliance_buildings ab ON ab.alliance_id = am.alliance_id
        JOIN alliance_building_definitions abd ON abd.id = ab.building_definition_id
        WHERE am.player_id = $1
          AND am.is_active = true
          AND abd.code = 'training_field'
          AND ab.is_unlocked = true
        LIMIT 1
    `, [playerId]);

    if (res.rows.length === 0) return 0;

    const { level, level_effects } = res.rows[0];
    const effects = typeof level_effects === 'string'
        ? JSON.parse(level_effects)
        : level_effects || [];

    const effect = getEffectForLevel(effects, Number(level));
    return Number(effect?.statsPercent) || 0;
};

// ===== STAT BREAKDOWN =====
const CORE_STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'charisma', 'luck'];

const computeStatBreakdown = ({ baseStats, equippedItems, petBonuses, alliancePercent }) => {
    const base = normalizeStats(baseStats);
    const pct = Number(alliancePercent) || 0;

    const equipmentSum = {};
    (equippedItems || []).forEach((item) => addStats(equipmentSum, item.stats || item || {}));

    const pet = normalizeStats(petBonuses);

    const breakdown = {};
    for (const stat of CORE_STATS) {
        const baseVal = base[stat] || 0;
        const equipVal = equipmentSum[stat] || 0;
        const petVal = pet[stat] || 0;
        const allianceVal = Math.round(baseVal * pct / 100);

        breakdown[stat] = {
            base: baseVal,
            equipment: equipVal,
            pet: petVal,
            alliancePercent: pct,
            alliance: allianceVal,
            total: baseVal + equipVal + petVal + allianceVal
        };
    }

    return breakdown;
};

const computeMaxHp = (totalConstitution = 0) => {
    const con = Number(totalConstitution) || 0;
    return 100 + (con * 20);
};

// ===== POWER =====
const RARITY_POWER_MAP = {
    common: 0,
    uncommon: 10,
    rare: 25,
    epic: 60,
    legendary: 150,
    mythic: 300
};

const computePower = (totalStats, level, equippedItems, derivedStats) => {
    const s = Number(totalStats.strength) || 0;
    const d = Number(totalStats.dexterity) || 0;
    const c = Number(totalStats.constitution) || 0;
    const i = Number(totalStats.intelligence) || 0;
    const l = Number(totalStats.luck) || 0;
    const ch = Number(totalStats.charisma) || 0;

    const attributePower = Math.floor(s * 4 + d * 3 + c * 4 + i * 3 + l * 2 + ch * 1.5);

    const avgWeaponDmg = ((Number(totalStats.damage_min) || 0) + (Number(totalStats.damage_max) || 0)) / 2;
    const armor = Number(totalStats.armor) || 0;
    const defenseFlat = Number(totalStats.defense) || 0;

    const combatPower = Math.floor(
        (avgWeaponDmg || 0) * 4 +
        armor * 3 +
        defenseFlat * 3 +
        (Number(derivedStats.critChance) || 0) * 12 +
        (Number(derivedStats.blockChance) || 0) * 12 +
        (Number(derivedStats.healingPower) || 0) * 8 +
        (Number(derivedStats.skillDamageBonus) || 0) * 8
    );

    const levelPower = (Number(level) || 0) * 25;

    const rarityPower = (equippedItems || []).reduce((sum, item) => {
        return sum + (RARITY_POWER_MAP[item.rarity] || 0);
    }, 0);

    const total = Math.floor(attributePower + combatPower + levelPower + rarityPower);

    return {
        total,
        breakdown: {
            attributes: attributePower,
            combat: combatPower,
            level: levelPower,
            rarity: rarityPower
        }
    };
};

// ===== DERIVED STATS =====
const computeDerivedStats = (totalStats = {}) => {
    const s = Number(totalStats.strength) || 0;
    const d = Number(totalStats.dexterity) || 0;
    const c = Number(totalStats.constitution) || 0;
    const i = Number(totalStats.intelligence) || 0;
    const l = Number(totalStats.luck) || 0;

    const weaponMin = Number(totalStats.damage_min) || 0;
    const weaponMax = Number(totalStats.damage_max) || 0;
    const armor = Number(totalStats.armor) || 0;
    const defenseFlat = Number(totalStats.defense) || 0;

    return {
        maxHp: computeMaxHp(c),
        physicalDamageMin: weaponMin + s * 2,
        physicalDamageMax: weaponMax + s * 2,
        defense: armor + defenseFlat + Math.floor(c / 2),
        critChance: Math.min(d * 0.25, 25),
        blockChance: Math.min(l * 0.25, 25),
        healingPower: Math.min(i * 0.5, 25),
        skillDamageBonus: Math.min(i * 0.25, 25)
    };
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
        `SELECT COALESCE(pi.base_stats, it.base_stats) AS stats, it.rarity
         FROM player_items pi
         JOIN items_templates it ON pi.template_id = it.id
         WHERE pi.player_id = $1 AND pi.is_equipped = true`,
        [playerId]
    );
    return res.rows.map((row) => ({
        stats: normalizeStats(row.stats),
        rarity: row.rarity
    }));
};

const getActivePetBonuses = async (playerId, client) => {
    const db = getDb(client);
    const res = await db.query(
        `SELECT p.bonus_stats, pp.bonus_growth
         FROM player_pets pp 
         JOIN pets p ON pp.pet_id = p.id 
         WHERE pp.player_id = $1 AND pp.is_active = true AND pp.current_hunger > 0 
         LIMIT 1`,
        [playerId]
    );
    if (res.rows.length === 0) return {};
    const base = normalizeStats(res.rows[0]?.bonus_stats);
    const growth = normalizeStats(res.rows[0]?.bonus_growth);
    const merged = { ...base };
    Object.entries(growth).forEach(([key, val]) => {
        merged[key] = (merged[key] || 0) + (Number(val) || 0);
    });
    return merged;
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

    const alliancePercent = await getAllianceStatsPercent(basePlayer.id, db);

    const totalStats = computeTotalStats({
        baseStats: basePlayer.stats,
        equippedItems: equippedStats,
        petBonuses,
        alliancePercent
    });

    const statBreakdown = computeStatBreakdown({
        baseStats: basePlayer.stats,
        equippedItems: equippedStats,
        petBonuses,
        alliancePercent
    });

    const derivedStats = computeDerivedStats(totalStats);

    const power = computePower(totalStats, basePlayer.level, equippedStats, derivedStats);

    const activeBonuses = { alliance: [] };
    if (alliancePercent > 0) {
        activeBonuses.alliance.push({
            source: 'Campo de Entrenamiento',
            label: `+${alliancePercent}% atributos`,
            statsPercent: alliancePercent
        });
    }

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
        energy: currentEnergy,
        valor: currentValor,
        last_regen_at: lastRegenAt,
        calculatedMaxHp: maxHp,
        calculated_max_hp: maxHp,
        total_stats: totalStats,
        stat_breakdown: statBreakdown,
        derived_stats: derivedStats,
        power,
        active_bonuses: activeBonuses
    };
};

module.exports = {
    HP_REGEN_AMOUNT,
    HP_REGEN_EVERY_SECONDS,
    computeTotalStats,
    computeMaxHp,
    applyRegen,
    hydratePlayer,
    computeStatBreakdown,
    computeDerivedStats,
    computePower,
    getAllianceStatsPercent
};