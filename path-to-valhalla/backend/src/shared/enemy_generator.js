const crypto = require('crypto');
const { computeEnemyXp } = require('./xp_rewards');

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const seededRandom = (seedString) => {
    const hash = crypto.createHash('sha256').update(String(seedString || '')).digest();
    let state = hash.readUInt32LE(0);
    return () => {
        // Mulberry32
        state |= 0;
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const randomInt = (min, max, rng) => {
    const r = rng ? rng() : Math.random();
    return Math.floor(r * (max - min + 1)) + min;
};

const generateEnemyInstance = (enemyRow, playerId, expeditionId) => {
    const seed = `${playerId || 'p0'}-${enemyRow?.id || 'e0'}-${expeditionId || 'exp0'}`;
    const rng = seededRandom(seed);

    const tier = Number(enemyRow.difficulty_tier) || 1;
    const isBoss = !!enemyRow.is_boss;

    const level = randomInt(Number(enemyRow.min_level) || 1, Number(enemyRow.max_level) || 1, rng);

    const tierHpFactor = isBoss ? 5 : tier === 3 ? 2.4 : tier === 2 ? 1.6 : 1;
    const tierArmorFactor = isBoss ? 3 : tier === 3 ? 2.0 : tier === 2 ? 1.4 : 1;
    const tierDmgRange = isBoss
        ? [2.0, 2.6]
        : tier === 3
            ? [1.45, 1.85]
            : tier === 2
                ? [1.15, 1.45]
                : [0.85, 1.15];

    const variation = isBoss
        ? { hp: 0.18, dmg: 0.15, armor: 0.25 }
        : tier === 3
            ? { hp: 0.15, dmg: 0.12, armor: 0.22 }
            : tier === 2
                ? { hp: 0.12, dmg: 0.10, armor: 0.18 }
                : { hp: 0.10, dmg: 0.08, armor: 0.15 };

    // Base stats
    const baseHpT1 = Math.round(40 + 6 * Math.pow(level, 2));
    const hpBase = baseHpT1 * tierHpFactor;
    const dmgBase = Math.round(4 + 1.2 * Math.pow(level, 1.25));
    const dmgBaseMin = dmgBase * tierDmgRange[0];
    const dmgBaseMax = dmgBase * tierDmgRange[1];
    const armorBase = Math.round((1 + level * 0.8) * tierArmorFactor);

    // Apply overrides if provided, otherwise generate with variation
    // Overrides only if explicitly provided (both bounds for hp/damage)
    const hasHpOverride = enemyRow.hp_min != null && enemyRow.hp_max != null;
    const hasDmgOverride = enemyRow.damage_min != null && enemyRow.damage_max != null;
    const hasArmorOverride = enemyRow.armor != null;

    const hpValue = hasHpOverride
        ? randomInt(
            Number(enemyRow.hp_min ?? enemyRow.hp_max ?? hpBase),
            Number(enemyRow.hp_max ?? enemyRow.hp_min ?? hpBase),
            rng
        )
        : Math.round(hpBase * (1 - variation.hp + (2 * variation.hp * rng())));

    const dmgMinValue = hasDmgOverride
        ? Number(enemyRow.damage_min ?? enemyRow.damage_max ?? dmgBaseMin)
        : Math.round(dmgBaseMin * (1 - variation.dmg + (2 * variation.dmg * rng())));

    const dmgMaxValue = hasDmgOverride
        ? Number(enemyRow.damage_max ?? enemyRow.damage_min ?? dmgBaseMax)
        : Math.round(dmgBaseMax * (1 - variation.dmg + (2 * variation.dmg * rng())));

    const armorValue = hasArmorOverride
        ? Number(enemyRow.armor)
        : Math.round(armorBase * (1 - variation.armor + (2 * variation.armor * rng())));

    // Elite minor (only tiers 1 & 2, non-boss)
    let isEliteMinor = false;
    let hpFinal = hpValue;
    let dmgMinFinal = Math.min(dmgMinValue, dmgMaxValue);
    let dmgMaxFinal = Math.max(dmgMinValue, dmgMaxValue);
    let armorFinal = armorValue;

    if (!isBoss && (tier === 1 || tier === 2) && rng() <= 0.20) {
        isEliteMinor = true;
        hpFinal = Math.round(hpFinal * 1.12);
        dmgMinFinal = Math.round(dmgMinFinal * 1.08);
        dmgMaxFinal = Math.round(dmgMaxFinal * 1.08);
        armorFinal = Math.round(armorFinal + 1);
    }

    // Rewards preview (XP uses neutral playerLevel = level here; actual awarded XP will use player level in battle)
    // Crit / block base by tier or overrides
    const baseCritOverride = enemyRow.crit_chance;
    const baseBlockOverride = enemyRow.block_chance;

    const baseCritCalc = (() => {
        if (isBoss) return Math.min(25, 10 + Math.floor(level / 6));
        if (tier === 3) return Math.min(20, 7 + Math.floor(level / 7));
        if (tier === 2) return Math.min(16, 5 + Math.floor(level / 8));
        return Math.min(12, 3 + Math.floor(level / 10));
    })();

    const baseBlockCalc = (() => {
        if (isBoss) return Math.min(22, 8 + Math.floor(level / 8));
        if (tier === 3) return Math.min(18, 6 + Math.floor(level / 9));
        if (tier === 2) return Math.min(14, 4 + Math.floor(level / 10));
        return Math.min(10, 2 + Math.floor(level / 12));
    })();

    const baseCrit = baseCritOverride != null ? Number(baseCritOverride) : baseCritCalc;
    const baseBlock = baseBlockOverride != null ? Number(baseBlockOverride) : baseBlockCalc;

    const critVariation = 0.02;
    const blockVariation = 0.02;
    const critFinal = clamp(Math.round(baseCrit * (1 - critVariation + (2 * critVariation * rng()))), 0, 30);
    const blockFinal = clamp(Math.round(baseBlock * (1 - blockVariation + (2 * blockVariation * rng()))), 0, 30);

    let xpPreview = enemyRow.xp_reward ?? computeEnemyXp({ enemy: enemyRow, playerLevel: level, enemyLevel: level, isElite: isEliteMinor });

    return {
        level,
        hp: hpFinal,
        hp_max: hpFinal,
        hp_current: hpFinal,
        damage_min: Math.min(dmgMinFinal, dmgMaxFinal),
        damage_max: Math.max(dmgMinFinal, dmgMaxFinal),
        armor: armorFinal,
        crit_chance: critFinal,
        block_chance: blockFinal,
        is_elite_minor: isEliteMinor,
        rewardsPreview: {
            xp: xpPreview
        }
    };
};

const mapEnemyForBestiary = (enemyRow, enemyInstance) => {
    const instance = enemyInstance || {};
    return {
        id: enemyRow.id,
        name: enemyRow.name,
        image_url: enemyRow.image_url,
        zone_id: enemyRow.zone_id,
        difficulty_tier: enemyRow.difficulty_tier,
        is_boss: enemyRow.is_boss,
        level_range: {
            min_level: enemyRow.min_level,
            max_level: enemyRow.max_level
        },
        stats_range_estimate: {
            hp_min_est: instance.hp_min_est || null,
            hp_max_est: instance.hp_max_est || null,
            dmg_min_est: instance.dmg_min_est || null,
            dmg_max_est: instance.dmg_max_est || null,
            armor_est: instance.armor_est || null
        },
        lore: enemyRow.description
    };
};

module.exports = { seededRandom, randomInt, generateEnemyInstance, mapEnemyForBestiary };
