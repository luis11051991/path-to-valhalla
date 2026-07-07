const pool = require('../config/db');

function toNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}

function buildStatisticsResponse(row) {
    const battlesTotal = toNumber(row.battles_total);
    const battlesWon = toNumber(row.battles_won);
    const battlesLost = toNumber(row.battles_lost);
    const winRate = battlesTotal > 0 ? Math.round((battlesWon / battlesTotal) * 100) : 0;

    return {
        battlesTotal,
        battlesWon,
        battlesLost,
        winRate,
        dungeonsCompleted: toNumber(row.expeditions_completed),
        bossesKilled: toNumber(row.bosses_killed),
        hiddenMobsKilled: toNumber(row.hidden_mobs_killed),
        achievementsCompleted: toNumber(row.achievements_completed),
        achievementsTotal: 0,
        achievementPhasesCompleted: toNumber(row.achievement_phases_completed),
        bestiaryDiscovered: toNumber(row.bestiary_discovered),
        questsCompleted: toNumber(row.quests_completed)
    };
}

async function getPublicProfile(targetPlayerId) {
    const playerResult = await pool.query(`
        SELECT
            p.id,
            p.username,
            p.level,
            p.race,
            p.class_path,
            p.last_login,
            p.gender,
            c.name AS class_name,
            c.image_url AS class_image
        FROM players p
        LEFT JOIN classes c ON c.id = p.class_id
        WHERE p.id = $1
    `, [targetPlayerId]);

    if (playerResult.rows.length === 0) {
        const error = new Error('Jugador no encontrado.');
        error.statusCode = 404;
        throw error;
    }

    const playerRow = playerResult.rows[0];

    const allianceResult = await pool.query(`
        SELECT
            a.id,
            a.name,
            a.tag,
            a.logo_url AS "logoUrl",
            am.role
        FROM alliances a
        JOIN alliance_members am ON am.alliance_id = a.id
        WHERE am.player_id = $1
          AND am.is_active = true
          AND am.left_at IS NULL
          AND a.is_active = true
        LIMIT 1
    `, [targetPlayerId]);

    const statisticsResult = await pool.query(`
        SELECT
            battles_total,
            battles_won,
            battles_lost,
            expeditions_completed,
            bosses_killed,
            hidden_mobs_killed,
            achievements_completed,
            achievement_phases_completed,
            bestiary_discovered,
            quests_completed
        FROM player_statistics
        WHERE player_id = $1
    `, [targetPlayerId]);

    const achievementsTotalResult = await pool.query(`
        SELECT COUNT(*) AS total
        FROM achievement_definitions
        WHERE is_active = true
    `);

    const statisticsRow = statisticsResult.rows[0] || {};
    const statistics = buildStatisticsResponse(statisticsRow);
    statistics.achievementsTotal = toNumber(achievementsTotalResult.rows[0]?.total);

    return {
        player: {
            id: String(playerRow.id),
            username: playerRow.username,
            level: toNumber(playerRow.level),
            race: playerRow.race,
            gender: playerRow.gender || 'male',
            classPath: playerRow.class_path,
            className: playerRow.class_name,
            avatarUrl: playerRow.class_image || null,
            lastLogin: playerRow.last_login || null
        },
        alliance: allianceResult.rows.length > 0 ? {
            id: String(allianceResult.rows[0].id),
            name: allianceResult.rows[0].name,
            tag: allianceResult.rows[0].tag,
            logoUrl: allianceResult.rows[0].logoUrl || null,
            role: allianceResult.rows[0].role
        } : null,
        statistics
    };
}

module.exports = {
    getPublicProfile
};
