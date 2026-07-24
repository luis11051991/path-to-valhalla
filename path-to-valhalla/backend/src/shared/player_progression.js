const { getRequiredXp } = require('./level_xp');

async function applyExperienceToPlayer(client, playerId, xpGain) {
    const res = await client.query(
        'SELECT level, experience, stat_points FROM players WHERE id = $1',
        [playerId]
    );

    if (res.rows.length === 0) {
        return { error: 'Player not found' };
    }

    const row = res.rows[0];
    const oldLevel = parseInt(row.level) || 1;
    let currentLevel = oldLevel;
    let currentXp = (parseInt(row.experience) || 0) + xpGain;
    let currentStatPoints = parseInt(row.stat_points) || 0;
    let levelsGained = 0;

    while (true) {
        const xpNeeded = getRequiredXp(currentLevel);
        if (currentXp >= xpNeeded) {
            currentXp -= xpNeeded;
            currentLevel++;
            currentStatPoints += 5;
            levelsGained++;
        } else {
            break;
        }
    }

    if (levelsGained > 0) {
        await client.query(
            'UPDATE players SET experience = $1, level = $2, stat_points = $3 WHERE id = $4',
            [currentXp, currentLevel, currentStatPoints, playerId]
        );
    } else {
        await client.query(
            'UPDATE players SET experience = $1 WHERE id = $2',
            [currentXp, playerId]
        );
    }

    return {
        xpGained: xpGain,
        oldLevel,
        newLevel: currentLevel,
        levelsGained,
        remainingExperience: currentXp,
        statPointsGained: levelsGained * 5
    };
}

module.exports = { applyExperienceToPlayer };
