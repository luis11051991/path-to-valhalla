// Shared XP rules for player leveling
const xpToNext = (level) => {
    const lvl = Math.max(1, Number(level) || 1);
    return Math.round(100 * Math.pow(lvl, 2));
};

const ODIN_LEVEL_XP = xpToNext(100);

const getRequiredXp = (level) => {
    const lvl = Math.max(1, Number(level) || 1);
    return lvl >= 100 ? ODIN_LEVEL_XP : xpToNext(lvl);
};

module.exports = { xpToNext, ODIN_LEVEL_XP, getRequiredXp };
