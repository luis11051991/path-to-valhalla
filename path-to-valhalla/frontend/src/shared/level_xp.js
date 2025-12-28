// Shared XP rules for player leveling
export const xpToNext = (level) => {
    const lvl = Math.max(1, Number(level) || 1);
    return Math.round(100 * Math.pow(lvl, 2));
};

export const ODIN_LEVEL_XP = xpToNext(100);

export const getRequiredXp = (level) => {
    const lvl = Math.max(1, Number(level) || 1);
    return lvl >= 100 ? ODIN_LEVEL_XP : xpToNext(lvl);
};
