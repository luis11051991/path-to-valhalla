const pool = require('../config/db');

const ACTIVE_SEASON_CODE = 'S01';
const HIDDEN_NAME = '???';
const HIDDEN_DESCRIPTION = 'Sigue explorando para descubrir este logro.';
const HIDDEN_FULL_DESCRIPTION = 'Este logro permanece oculto hasta que cumplas una condicion especial.';

function normalizeCurrency(currency) {
    const copper = Math.max(0, Math.trunc(Number(currency.copper || 0)));
    const silver = Math.max(0, Math.trunc(Number(currency.silver || 0)));
    const gold = Math.max(0, Math.trunc(Number(currency.gold || 0)));
    const onix = Math.max(0, Math.trunc(Number(currency.onix || currency.onyx || 0)));

    const silverFromCopper = Math.floor(copper / 100);
    const finalCopper = copper % 100;

    const totalSilver = silver + silverFromCopper;
    const goldFromSilver = Math.floor(totalSilver / 100);
    const finalSilver = totalSilver % 100;

    return {
        copper: finalCopper,
        silver: finalSilver,
        gold: gold + goldFromSilver,
        onix
    };
}

function parseJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];

    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function parseJsonObject(value) {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;

    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
        return {};
    }
}

function normalizeRewardKeys(reward) {
    const parsedReward = parseJsonObject(reward);
    if (parsedReward.onyx !== undefined && parsedReward.onix === undefined) {
        return { ...parsedReward, onix: parsedReward.onyx };
    }
    return parsedReward;
}

function matchesConditions(conditions = {}, metadata = {}) {
    const parsedConditions = parseJsonObject(conditions);
    if (!parsedConditions || Object.keys(parsedConditions).length === 0) return true;

    return Object.entries(parsedConditions).every(([key, expected]) => {
        if (!(key in metadata)) return false;
        const actual = metadata[key];

        if (typeof expected === 'number') {
            return Number(actual) === expected;
        }

        if (typeof expected === 'boolean') {
            return Boolean(actual) === expected;
        }

        return String(actual) === String(expected);
    });
}

function isCompletedStatus(status) {
    return status === 'Completado' || status === 'Reclamable' || status === 'Reclamado';
}

function mapAchievementRow(row) {
    const status = row.status || 'En progreso';
    const isHidden = row.is_secret === true && status === 'Oculto';
    const reward = isHidden ? {} : normalizeRewardKeys(row.reward);

    return {
        id: Number(row.id),
        code: row.code,
        name: isHidden ? HIDDEN_NAME : row.name,
        category: row.category,
        rarity: row.rarity,
        description: isHidden ? HIDDEN_DESCRIPTION : row.description,
        fullDescription: isHidden ? HIDDEN_FULL_DESCRIPTION : row.full_description,
        progress: Number(row.progress || 0),
        target: Number(row.player_target || row.target || 0),
        status: isHidden ? 'Oculto' : status,
        reward,
        advice: isHidden ? null : row.advice,
        routeLabels: isHidden ? [] : parseJsonArray(row.route_labels),
        points: Number(row.points || 0),
        claimedAt: row.claimed_at || null,
        completedAt: row.completed_at || null,
        createdAt: row.created_at
    };
}

async function ensurePlayerAchievements(playerId, client = pool) {
    await client.query(`
        INSERT INTO public.player_achievements
            (player_id, achievement_id, progress, target, status, created_at, updated_at)
        SELECT
            $1,
            ad.id,
            0,
            ad.target,
            CASE
                WHEN ad.is_secret = true AND ad.is_hidden_until_unlocked = true THEN 'Oculto'
                ELSE 'En progreso'
            END,
            NOW(),
            NOW()
        FROM public.achievement_definitions ad
        WHERE ad.is_active = true
          AND ad.season_code = $2
          AND NOT EXISTS (
              SELECT 1
              FROM public.player_achievements pa
              WHERE pa.player_id = $1
                AND pa.achievement_id = ad.id
          )
        ON CONFLICT (player_id, achievement_id) DO NOTHING
    `, [playerId, ACTIVE_SEASON_CODE]);
}

async function getUserAchievements(playerId) {
    await ensurePlayerAchievements(playerId);

    const result = await pool.query(`
        SELECT
            ad.id,
            ad.code,
            ad.name,
            ad.category,
            ad.rarity,
            ad.description,
            ad.full_description,
            ad.target,
            ad.points,
            ad.event_type,
            ad.is_secret,
            ad.is_hidden_until_unlocked,
            ad.advice,
            ad.route_labels,
            ad.reward,
            ad.created_at,
            pa.progress,
            pa.target AS player_target,
            pa.status,
            pa.completed_at,
            pa.claimed_at
        FROM public.achievement_definitions ad
        JOIN public.player_achievements pa
          ON pa.achievement_id = ad.id
         AND pa.player_id = $1
        WHERE ad.is_active = true
          AND ad.season_code = $2
        ORDER BY ad.sort_order ASC, ad.phase ASC, ad.created_at DESC, ad.id ASC
    `, [playerId, ACTIVE_SEASON_CODE]);

    const rows = result.rows;
    const achievements = rows.map(mapAchievementRow);
    const summary = rows.reduce((acc, row) => {
        const points = Number(row.points || 0);
        const status = row.status || 'En progreso';

        acc.total += 1;
        if (isCompletedStatus(status)) {
            acc.completed += 1;
            acc.points += points;
        }
        if (status === 'Reclamable') acc.pendingRewards += 1;

        return acc;
    }, {
        total: 0,
        completed: 0,
        points: 0,
        pendingRewards: 0
    });

    return { summary, achievements };
}

async function getPlayerCurrency(client, playerId, lock = false) {
    const result = await client.query(`
        SELECT copper, silver, gold, onix
        FROM public.players
        WHERE id = $1
        ${lock ? 'FOR UPDATE' : ''}
    `, [playerId]);

    if (result.rows.length === 0) {
        const error = new Error('Jugador no encontrado.');
        error.statusCode = 404;
        throw error;
    }

    const player = result.rows[0];
    return {
        copper: Number(player.copper || 0),
        silver: Number(player.silver || 0),
        gold: Number(player.gold || 0),
        onix: Number(player.onix || 0)
    };
}

async function applyRewardsToPlayer(client, playerId, rewards) {
    const currentCurrency = await getPlayerCurrency(client, playerId, true);
    const rewardTotals = rewards.reduce((acc, reward) => {
        const normalizedReward = normalizeRewardKeys(reward);
        return {
            copper: acc.copper + Number(normalizedReward.copper || 0),
            silver: acc.silver + Number(normalizedReward.silver || 0),
            gold: acc.gold + Number(normalizedReward.gold || 0),
            onix: acc.onix + Number(normalizedReward.onix || 0)
        };
    }, { copper: 0, silver: 0, gold: 0, onix: 0 });

    const userCurrency = normalizeCurrency({
        copper: currentCurrency.copper + rewardTotals.copper,
        silver: currentCurrency.silver + rewardTotals.silver,
        gold: currentCurrency.gold + rewardTotals.gold,
        onix: currentCurrency.onix + rewardTotals.onix
    });

    await client.query(`
        UPDATE public.players
        SET copper = $1,
            silver = $2,
            gold = $3,
            onix = $4
        WHERE id = $5
    `, [
        userCurrency.copper,
        userCurrency.silver,
        userCurrency.gold,
        userCurrency.onix,
        playerId
    ]);

    return userCurrency;
}

async function claimAchievement(playerId, achievementId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await ensurePlayerAchievements(playerId, client);

        const achievementResult = await client.query(`
            SELECT
                pa.id AS player_achievement_id,
                pa.status,
                pa.claimed_at,
                ad.id AS achievement_id,
                ad.reward
            FROM public.player_achievements pa
            JOIN public.achievement_definitions ad
              ON ad.id = pa.achievement_id
            WHERE pa.player_id = $1
              AND ad.id = $2
              AND ad.is_active = true
              AND ad.season_code = $3
            FOR UPDATE OF pa
        `, [playerId, achievementId, ACTIVE_SEASON_CODE]);

        if (achievementResult.rows.length === 0) {
            const error = new Error('Logro no encontrado.');
            error.statusCode = 404;
            throw error;
        }

        const achievement = achievementResult.rows[0];

        if (achievement.status !== 'Reclamable') {
            const error = new Error('Este logro no esta disponible para reclamar.');
            error.statusCode = 400;
            throw error;
        }

        if (achievement.claimed_at) {
            const error = new Error('Este logro ya fue reclamado.');
            error.statusCode = 409;
            throw error;
        }

        const logResult = await client.query(`
            SELECT id
            FROM public.achievement_claim_logs
            WHERE player_id = $1
              AND achievement_id = $2
            LIMIT 1
        `, [playerId, achievementId]);

        if (logResult.rows.length > 0) {
            const error = new Error('Este logro ya fue reclamado.');
            error.statusCode = 409;
            throw error;
        }

        const rewardSnapshot = normalizeRewardKeys(achievement.reward);
        const userCurrency = await applyRewardsToPlayer(client, playerId, [rewardSnapshot]);

        const updatedResult = await client.query(`
            UPDATE public.player_achievements
            SET status = 'Reclamado',
                claimed_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
            RETURNING achievement_id AS id, status, claimed_at
        `, [achievement.player_achievement_id]);

        await client.query(`
            INSERT INTO public.achievement_claim_logs
                (player_id, achievement_id, reward_snapshot, claimed_at)
            VALUES ($1, $2, $3, NOW())
        `, [playerId, achievementId, rewardSnapshot]);

        await client.query('COMMIT');

        const updatedAchievement = updatedResult.rows[0];
        return {
            success: true,
            message: 'Recompensa reclamada correctamente.',
            userCurrency,
            achievement: {
                id: Number(updatedAchievement.id),
                status: updatedAchievement.status,
                claimedAt: updatedAchievement.claimed_at
            }
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function claimAllAchievements(playerId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await ensurePlayerAchievements(playerId, client);

        const claimableResult = await client.query(`
            SELECT
                pa.id AS player_achievement_id,
                ad.id AS achievement_id,
                ad.reward
            FROM public.player_achievements pa
            JOIN public.achievement_definitions ad
              ON ad.id = pa.achievement_id
            WHERE pa.player_id = $1
              AND pa.status = 'Reclamable'
              AND pa.claimed_at IS NULL
              AND ad.is_active = true
              AND ad.season_code = $2
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.achievement_claim_logs acl
                  WHERE acl.player_id = pa.player_id
                    AND acl.achievement_id = pa.achievement_id
              )
            FOR UPDATE OF pa
        `, [playerId, ACTIVE_SEASON_CODE]);

        const claimableAchievements = claimableResult.rows;

        if (claimableAchievements.length === 0) {
            const userCurrency = await getPlayerCurrency(client, playerId, false);
            await client.query('COMMIT');
            return {
                success: true,
                claimedCount: 0,
                userCurrency
            };
        }

        const rewardSnapshots = claimableAchievements.map((achievement) => normalizeRewardKeys(achievement.reward));
        const userCurrency = await applyRewardsToPlayer(client, playerId, rewardSnapshots);
        const playerAchievementIds = claimableAchievements.map((achievement) => achievement.player_achievement_id);

        await client.query(`
            UPDATE public.player_achievements
            SET status = 'Reclamado',
                claimed_at = NOW(),
                updated_at = NOW()
            WHERE id = ANY($1::bigint[])
        `, [playerAchievementIds]);

        for (const achievement of claimableAchievements) {
            await client.query(`
                INSERT INTO public.achievement_claim_logs
                    (player_id, achievement_id, reward_snapshot, claimed_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (player_id, achievement_id) DO NOTHING
            `, [
                playerId,
                achievement.achievement_id,
                normalizeRewardKeys(achievement.reward)
            ]);
        }

        await client.query('COMMIT');

        return {
            success: true,
            claimedCount: claimableAchievements.length,
            userCurrency
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function incrementProgress(playerId, eventType, amount = 1, metadata = {}, externalClient = null) {
    if (!playerId) {
        const error = new Error('Jugador requerido para actualizar logros.');
        error.statusCode = 400;
        throw error;
    }

    const normalizedEventType = String(eventType || '').trim();
    if (!normalizedEventType) {
        const error = new Error('Tipo de evento de logro invalido.');
        error.statusCode = 400;
        throw error;
    }

    const parsedAmount = Math.trunc(Number(amount));
    const safeAmount = Number.isFinite(parsedAmount) && parsedAmount >= 1 ? parsedAmount : 1;
    const client = externalClient || await pool.connect();
    const ownsTransaction = !externalClient;

    try {
        if (ownsTransaction) await client.query('BEGIN');
        await ensurePlayerAchievements(playerId, client);

        const result = await client.query(`
            SELECT
                ad.id AS achievement_id,
                ad.code,
                ad.target AS definition_target,
                ad.conditions,
                pa.id AS player_achievement_id,
                pa.progress,
                pa.target AS player_target,
                pa.status,
                pa.completed_at
            FROM public.player_achievements pa
            JOIN public.achievement_definitions ad
              ON ad.id = pa.achievement_id
            WHERE pa.player_id = $1
              AND ad.event_type = $2
              AND ad.is_active = true
              AND ad.season_code = $3
            ORDER BY ad.phase ASC, ad.sort_order ASC, ad.id ASC
            FOR UPDATE OF pa
        `, [playerId, normalizedEventType, ACTIVE_SEASON_CODE]);

        const updated = [];
        for (const row of result.rows) {
            if (row.status === 'Reclamado') continue;
            if (row.status === 'Bloqueado') continue;
            if (!matchesConditions(row.conditions, metadata)) continue;

            const target = Number(row.player_target || row.definition_target || 0);
            const currentProgress = Number(row.progress || 0);
            const nextProgress = target > 0
                ? Math.min(currentProgress + safeAmount, target)
                : currentProgress + safeAmount;
            const isComplete = target > 0 && nextProgress >= target;
            const nextStatus = row.status === 'Reclamable'
                ? 'Reclamable'
                : isComplete
                    ? 'Reclamable'
                    : 'En progreso';
            const shouldSetCompletedAt = isComplete && !row.completed_at;

            const updateResult = await client.query(`
                UPDATE public.player_achievements
                SET progress = $1,
                    status = $2,
                    completed_at = CASE WHEN $3 THEN NOW() ELSE completed_at END,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING achievement_id AS id, progress, target, status
            `, [
                nextProgress,
                nextStatus,
                shouldSetCompletedAt,
                row.player_achievement_id
            ]);

            const updatedRow = updateResult.rows[0];
            updated.push({
                achievementId: Number(updatedRow.id),
                code: row.code,
                progress: Number(updatedRow.progress || 0),
                target: Number(updatedRow.target || 0),
                status: updatedRow.status
            });
        }

        if (ownsTransaction) await client.query('COMMIT');

        return {
            success: true,
            updated
        };
    } catch (error) {
        if (ownsTransaction) await client.query('ROLLBACK');
        throw error;
    } finally {
        if (ownsTransaction) client.release();
    }
}

module.exports = {
    ACTIVE_SEASON_CODE,
    getUserAchievements,
    ensurePlayerAchievements,
    incrementProgress,
    claimAchievement,
    claimAllAchievements,
    normalizeCurrency,
    applyRewardsToPlayer,
    matchesConditions
};
