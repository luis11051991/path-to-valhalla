const { randomInt, seededRandom } = require('./enemy_generator');

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_DROP_CHANCE = {
    common: 50,
    uncommon: 30,
    rare: 14,
    epic: 4.5,
    legendary: 1.3,
    mythic: 0.2
};

const RARITY_GREED_THRESHOLD = 'rare';

const isGreedItem = (rarity) => {
    const idx = RARITY_ORDER.indexOf(rarity);
    return idx >= RARITY_ORDER.indexOf(RARITY_GREED_THRESHOLD);
};

const computeStageRewards = async (enemies, partySize, difficulty, stageSeed, client) => {
    const diffMult = {
        easy: 0.8,
        normal: 1.0,
        hard: 1.2,
        inferno: 1.5
    }[difficulty] || 1.0;

    const rng = seededRandom(stageSeed);
    const rewards = { xp_total: 0, copper_total: 0, items: [], greedRolls: [] };

    // V1: per-enemy XP generous but safe
    // mob: ~30-80 XP, elite: ~100-180, boss: ~200-350 (before diff mult)
    for (const enemy of enemies) {
        const isBoss = !!enemy.is_boss;
        const isElite = !!enemy.is_elite;
        const baseXp = isBoss ? 250 : isElite ? 140 : 50;
        const baseCopper = isBoss ? randomInt(30, 60, `${stageSeed}-copper-${enemy.id}`)
                        : isElite ? randomInt(15, 35, `${stageSeed}-copper-${enemy.id}`)
                        : randomInt(5, 15, `${stageSeed}-copper-${enemy.id}`);
        rewards.xp_total += Math.floor(baseXp * diffMult);
        rewards.copper_total += Math.floor(baseCopper * diffMult);

        const dropRoll = rng() * 100;
        let cumulative = 0;
        for (const tier of RARITY_ORDER) {
            cumulative += RARITY_DROP_CHANCE[tier];
            if (dropRoll <= cumulative) {
                rewards.items.push({
                    name: `Botín ${tier}`,
                    rarity: tier,
                    template_id: null,
                    quantity: 1
                });
                break;
            }
        }
    }

    return rewards;
};

const createGreedRoll = (item, runId, stageId) => {
    return {
        run_id: runId,
        stage_id: stageId,
        item_name: item.name || item.item_name,
        item_rarity: item.rarity,
        item_template_id: item.template_id,
        rolls: [],
        resolved: false
    };
};

module.exports = { computeStageRewards, createGreedRoll, isGreedItem, RARITY_ORDER, RARITY_DROP_CHANCE, RARITY_GREED_THRESHOLD };
