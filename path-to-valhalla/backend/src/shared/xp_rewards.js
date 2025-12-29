const { getRequiredXp } = require('./level_xp');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const computeEnemyLevel = (enemy = {}) => {
    const minLevel = Number(enemy.min_level) || 0;
    const maxLevel = Number(enemy.max_level) || minLevel;
    return Math.max(1, Math.floor((minLevel + maxLevel) / 2));
};

const computeEnemyXp = ({ enemy = {}, playerLevel, enemyLevel, isElite }) => {
    const resolvedLevel = Math.max(1, enemyLevel || computeEnemyLevel(enemy));
    const required = getRequiredXp(resolvedLevel);

    const isBoss = !!enemy.is_boss;
    const tier = Number(enemy.difficulty_tier) || 1;

    const lowLevelRamp = resolvedLevel <= 10;
    let factor;
    if (lowLevelRamp) {
        if (isBoss) factor = 0.65;
        else if (tier === 3) factor = 0.42;
        else if (tier === 2) factor = 0.30;
        else factor = 0.20;
    } else {
        if (isBoss) factor = 0.28;
        else if (tier === 3) factor = 0.14;
        else if (tier === 2) factor = 0.10;
        else factor = 0.06;
    }

    const xpBase = Math.round(required * factor);

    const playerLvl = Math.max(1, Number(playerLevel) || resolvedLevel);
    const delta = resolvedLevel - playerLvl;
    const mult = clamp(1 + 0.03 * delta, 0.30, 1.25);

    let total = Math.round(xpBase * mult);
    if (enemy.is_elite_minor || isElite) total = Math.round(total * 1.05);

    return total;
};

module.exports = { clamp, computeEnemyLevel, computeEnemyXp };
