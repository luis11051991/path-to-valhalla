const { getRequiredXp } = require('./level_xp');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const computeEnemyLevel = (enemy = {}) => {
    const minLevel = Number(enemy.min_level) || 0;
    const maxLevel = Number(enemy.max_level) || minLevel;
    return Math.max(1, Math.floor((minLevel + maxLevel) / 2));
};

const computeEnemyXp = ({ enemy = {}, playerLevel }) => {
    const enemyLevel = computeEnemyLevel(enemy);
    const required = getRequiredXp(enemyLevel);

    let factor = 0.06;
    if (enemy.is_boss) factor = 0.28;
    else if (enemy.difficulty_tier === 3) factor = 0.14;
    else if (enemy.difficulty_tier === 2) factor = 0.10;

    const xpBase = Math.round(required * factor);

    const playerLvl = Math.max(1, Number(playerLevel) || enemyLevel);
    const delta = enemyLevel - playerLvl;
    const mult = clamp(1 + 0.03 * delta, 0.40, 1.35);

    return Math.round(xpBase * mult);
};

module.exports = { clamp, computeEnemyLevel, computeEnemyXp };
