const MAX_PET_LEVEL = 10;

function getPetTierMultiplier(tier) {
    if (tier === 1) return 5;
    if (tier === 2) return 7;
    if (tier === 3) return 10;
    return 5;
}

function getRequiredPetExp(level, tier) {
    const lvl = Math.max(1, Number(level) || 1);
    return lvl * getPetTierMultiplier(tier);
}

function getPetExpGainFromEnemy(enemy) {
    if (!enemy) return 1;
    if (enemy.is_boss) return 3;
    const tier = Number(enemy.difficulty_tier) || 1;
    if (tier === 1) return 1;
    if (tier === 2) return 2;
    if (tier === 3) return 3;
    return 1;
}

function getPetHungerCostFromEnemy(enemy) {
    if (!enemy) return 1;
    if (enemy.is_boss) return 2;
    return 1;
}

function mergePetBonuses(baseBonus, bonusGrowth) {
    const base = { ...(typeof baseBonus === 'string' ? JSON.parse(baseBonus) : baseBonus || {}) };
    const growth = { ...(typeof bonusGrowth === 'string' ? JSON.parse(bonusGrowth) : bonusGrowth || {}) };
    const result = { ...base };
    Object.entries(growth).forEach(([key, val]) => {
        result[key] = (result[key] || 0) + (typeof val === 'number' ? val : 0);
    });
    return result;
}

async function applyPetExperience(playerId, expGain, client, hungerCost) {
    const db = client || require('../config/db');

    const res = await db.query(`
        SELECT pp.id, pp.level, pp.experience, pp.current_hunger, pp.bonus_growth, p.bonus_stats, p.tier, p.name
        FROM player_pets pp
        JOIN pets p ON pp.pet_id = p.id
        WHERE pp.player_id = $1 AND pp.is_active = true
        LIMIT 1
        FOR UPDATE
    `, [playerId]);

    if (res.rows.length === 0) return { hadActivePet: false };

    const pet = res.rows[0];

    const hungerCostVal = Number(hungerCost) || 0;
    if (hungerCostVal > 0 && (pet.current_hunger <= 0)) {
        return {
            hadActivePet: true,
            petName: pet.name,
            expGained: 0,
            hungerLost: 0,
            newHunger: pet.current_hunger,
            skipped: true,
            skipReason: 'no_hunger',
            leveledUp: false,
            newLevel: pet.level,
            gainedStats: []
        };
    }

    const oldLevel = pet.level;

    if (pet.level >= MAX_PET_LEVEL) {
        if (hungerCostVal > 0) {
            const newHunger = Math.max(0, pet.current_hunger - hungerCostVal);
            await db.query('UPDATE player_pets SET current_hunger = $1 WHERE id = $2', [newHunger, pet.id]);
        }
        return {
            hadActivePet: true,
            petName: pet.name,
            expGained: 0,
            hungerLost: 0,
            newHunger: pet.current_hunger,
            leveledUp: false,
            newLevel: pet.level,
            gainedStats: []
        };
    }

    let { level, experience } = pet;
    let bonusGrowth = typeof pet.bonus_growth === 'string'
        ? JSON.parse(pet.bonus_growth)
        : { ...(pet.bonus_growth || {}) };
    const baseBonusStats = typeof pet.bonus_stats === 'string'
        ? JSON.parse(pet.bonus_stats)
        : { ...(pet.bonus_stats || {}) };
    const baseKeys = Object.keys(baseBonusStats);

    experience += expGain;
    let leveledUp = false;
    let newLevel = level;
    const gainedStats = [];

    while (experience >= getRequiredPetExp(newLevel, pet.tier) && newLevel < MAX_PET_LEVEL) {
        experience -= getRequiredPetExp(newLevel, pet.tier);
        newLevel++;

        if (baseKeys.length > 0) {
            const randomKey = baseKeys[Math.floor(Math.random() * baseKeys.length)];
            bonusGrowth[randomKey] = (bonusGrowth[randomKey] || 0) + 1;
            gainedStats.push(randomKey);
        }

        leveledUp = true;
    }

    if (newLevel >= MAX_PET_LEVEL) {
        experience = 0;
    }

    const currentHunger = pet.current_hunger;
    let newHunger = currentHunger;
    let hungerLost = 0;

    if (hungerCostVal > 0) {
        newHunger = Math.max(0, currentHunger - hungerCostVal);
        hungerLost = currentHunger - newHunger;
    }

    await db.query(`
        UPDATE player_pets
        SET level = $1, experience = $2, bonus_growth = $3,
            current_hunger = $4
        WHERE id = $5
    `, [newLevel, experience, JSON.stringify(bonusGrowth), newHunger, pet.id]);

    return {
        hadActivePet: true,
        petName: pet.name,
        expGained: expGain,
        hungerLost,
        newHunger,
        skipped: false,
        leveledUp,
        oldLevel,
        newLevel,
        gainedStats
    };
}

module.exports = {
    MAX_PET_LEVEL,
    getPetTierMultiplier,
    getRequiredPetExp,
    getPetExpGainFromEnemy,
    getPetHungerCostFromEnemy,
    mergePetBonuses,
    applyPetExperience
};
