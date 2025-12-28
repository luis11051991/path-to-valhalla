// backend/src/constants/levels.js
// Wrapper around the shared XP logic to keep backward compatibility
const { xpToNext, ODIN_LEVEL_XP, getRequiredXp } = require('../shared/level_xp');

const getXpRequiredForLevel = getRequiredXp;

module.exports = { xpToNext, ODIN_LEVEL_XP, getRequiredXp, getXpRequiredForLevel };
