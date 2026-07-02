const pool = require('../config/db');
const statisticsService = require('./statisticsService');

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

function mapAchievementRow(row) {
    const status = row.status || 'En progreso';
    const isHidden = row.is_secret === true && status === 'Oculto';
    const currentPhase = Number(row.current_phase || 1);
    const maxPhase = Number(row.player_max_phase || row.max_phase || 1);
    const isChain = Boolean(row.is_chain || maxPhase > 1);
    const reward = isHidden ? {} : normalizeRewardKeys(row.phase_reward || row.reward);
    const description = row.phase_description || row.description;
    const fullDescription = row.phase_full_description || row.full_description;
    const advice = row.phase_advice || row.advice;

    return {
        id: Number(row.id),
        code: row.code,
        name: isHidden ? HIDDEN_NAME : (row.base_name || row.name),
        category: row.category,
        rarity: row.rarity,
        description: isHidden ? HIDDEN_DESCRIPTION : description,
        fullDescription: isHidden ? HIDDEN_FULL_DESCRIPTION : fullDescription,
        progress: Number(row.progress || 0),
        target: Number(row.player_target || row.phase_target || row.target || 0),
        status: isHidden ? 'Oculto' : status,
        reward,
        advice: isHidden ? null : advice,
        routeLabels: isHidden ? [] : parseJsonArray(row.route_labels),
        points: Number(row.phase_points || row.points || 0),
        claimedPoints: Number(row.claimed_points || 0),
        claimedAt: row.claimed_at || null,
        completedAt: row.completed_at || null,
        createdAt: row.created_at,
        currentPhase,
        maxPhase,
        isChain,
        isCompleted: Boolean(row.is_completed),
        phaseLabel: `Fase ${currentPhase} / ${maxPhase}`
    };
}

async function ensurePlayerAchievements(playerId, client = pool) {
    await client.query(`
        INSERT INTO public.player_achievements
            (
                player_id,
                achievement_id,
                progress,
                target,
                status,
                current_phase,
                max_phase,
                is_completed,
                created_at,
                updated_at
            )
        SELECT
            $1,
            ad.id,
            0,
            COALESCE(ap.target, ad.target),
            CASE
                WHEN ad.is_secret = true AND ad.is_hidden_until_unlocked = true THEN 'Oculto'
                ELSE 'En progreso'
            END,
            1,
            COALESCE(NULLIF(ad.max_phase, 0), 1),
            false,
            NOW(),
            NOW()
        FROM public.achievement_definitions ad
        LEFT JOIN public.achievement_phases ap
          ON ap.achievement_id = ad.id
         AND ap.phase = 1
        WHERE ad.is_active = true
          AND ad.season_code = $2
          AND NOT EXISTS (
              SELECT 1
              FROM public.player_achievements pa
              WHERE pa.player_id = $1
                AND pa.achievement_id = ad.id
          )
        ON CONFLICT (player_id, achievement_id) DO UPDATE
        SET max_phase = EXCLUDED.max_phase,
            target = CASE
                WHEN player_achievements.status IN ('En progreso', 'Oculto')
                    THEN EXCLUDED.target
                ELSE player_achievements.target
            END,
            updated_at = NOW()
    `, [playerId, ACTIVE_SEASON_CODE]);
}

async function getUserAchievements(playerId) {
    await ensurePlayerAchievements(playerId);

    const result = await pool.query(`
        SELECT
            ad.id,
            ad.code,
            ad.name,
            ad.base_name,
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
            ad.max_phase,
            ad.is_chain,
            ad.chain_key,
            pa.progress,
            pa.target AS player_target,
            pa.status,
            pa.completed_at,
            pa.claimed_at,
            pa.current_phase,
            pa.max_phase AS player_max_phase,
            pa.is_completed,
            ap.target AS phase_target,
            ap.points AS phase_points,
            ap.reward AS phase_reward,
            ap.description AS phase_description,
            ap.full_description AS phase_full_description,
            ap.advice AS phase_advice,
            COALESCE(claimed.points, 0) AS claimed_points
        FROM public.achievement_definitions ad
        JOIN public.player_achievements pa
          ON pa.achievement_id = ad.id
         AND pa.player_id = $1
        LEFT JOIN public.achievement_phases ap
          ON ap.achievement_id = ad.id
         AND ap.phase = pa.current_phase
        LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(ap_claimed.points), 0) AS points
            FROM public.achievement_claim_logs acl
            JOIN public.achievement_phases ap_claimed
              ON ap_claimed.achievement_id = acl.achievement_id
             AND ap_claimed.phase = acl.phase
            WHERE acl.player_id = $1
              AND acl.achievement_id = ad.id
        ) claimed ON true
        WHERE ad.is_active = true
          AND ad.season_code = $2
        ORDER BY ad.sort_order ASC, ad.created_at DESC, ad.id ASC
    `, [playerId, ACTIVE_SEASON_CODE]);

    const rows = result.rows;
    const achievements = rows.map(mapAchievementRow);
    const summary = rows.reduce((acc, row) => {
        const status = row.status || 'En progreso';
        const isCompleted = row.is_completed === true || status === 'Reclamado';
        const claimedPoints = Number(row.claimed_points || 0);
        const currentPhasePoints = status === 'Reclamable'
            ? Number(row.phase_points || row.points || 0)
            : 0;

        acc.total += 1;
        if (isCompleted) acc.completed += 1;
        acc.points += claimedPoints + currentPhasePoints;
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

async function getClaimableAchievement(client, playerId, achievementId) {
    const result = await client.query(`
        SELECT
            pa.id AS player_achievement_id,
            pa.status,
            pa.progress,
            pa.target AS player_target,
            pa.claimed_at,
            pa.completed_at,
            pa.current_phase,
            pa.max_phase AS player_max_phase,
            pa.is_completed,
            ad.id AS achievement_id,
            ad.is_secret,
            ad.max_phase AS definition_max_phase,
            ad.reward,
            COALESCE(ap.target, ad.target) AS phase_target,
            COALESCE(ap.points, ad.points) AS phase_points,
            COALESCE(ap.reward, ad.reward) AS phase_reward,
            next_ap.target AS next_phase_target
        FROM public.player_achievements pa
        JOIN public.achievement_definitions ad
          ON ad.id = pa.achievement_id
        LEFT JOIN public.achievement_phases ap
          ON ap.achievement_id = ad.id
         AND ap.phase = pa.current_phase
        LEFT JOIN public.achievement_phases next_ap
          ON next_ap.achievement_id = ad.id
         AND next_ap.phase = pa.current_phase + 1
        WHERE pa.player_id = $1
          AND ad.id = $2
          AND ad.is_active = true
          AND ad.season_code = $3
        FOR UPDATE OF pa
    `, [playerId, achievementId, ACTIVE_SEASON_CODE]);

    return result.rows[0] || null;
}

function assertCanClaimAchievement(achievement) {
    if (!achievement) {
        const error = new Error('Logro no encontrado.');
        error.statusCode = 404;
        throw error;
    }

    if (achievement.status !== 'Reclamable') {
        const error = new Error('Este logro no esta disponible para reclamar.');
        error.statusCode = 400;
        throw error;
    }
}

async function assertPhaseWasNotClaimed(client, playerId, achievementId, phase) {
    const logResult = await client.query(`
        SELECT id
        FROM public.achievement_claim_logs
        WHERE player_id = $1
          AND achievement_id = $2
          AND phase = $3
        LIMIT 1
    `, [playerId, achievementId, phase]);

    if (logResult.rows.length > 0) {
        const error = new Error('Esta fase ya fue reclamada.');
        error.statusCode = 409;
        throw error;
    }
}

async function updateAchievementAfterClaim(client, achievement) {
    const currentPhase = Number(achievement.current_phase || 1);
    const maxPhase = Number(achievement.player_max_phase || achievement.definition_max_phase || 1);

    if (currentPhase < maxPhase) {
        const nextPhase = currentPhase + 1;
        const nextTarget = Number(achievement.next_phase_target || 0);
        if (!Number.isFinite(nextTarget) || nextTarget <= 0) {
            const error = new Error(`La fase ${nextPhase} del logro no esta configurada.`);
            error.statusCode = 500;
            throw error;
        }

        const updatedResult = await client.query(`
            UPDATE public.player_achievements
            SET current_phase = $1,
                max_phase = $2,
                progress = 0,
                target = $3,
                status = 'En progreso',
                claimed_at = NULL,
                completed_at = NULL,
                is_completed = false,
                updated_at = NOW()
            WHERE id = $4
            RETURNING achievement_id AS id,
                      progress,
                      target,
                      status,
                      claimed_at,
                      completed_at,
                      current_phase,
                      max_phase,
                      is_completed
        `, [
            nextPhase,
            maxPhase,
            nextTarget,
            achievement.player_achievement_id
        ]);

        return updatedResult.rows[0];
    }

    const updatedResult = await client.query(`
        UPDATE public.player_achievements
        SET progress = LEAST(progress, target),
            status = 'Reclamado',
            claimed_at = NOW(),
            completed_at = COALESCE(completed_at, NOW()),
            is_completed = true,
            updated_at = NOW()
        WHERE id = $1
        RETURNING achievement_id AS id,
                  progress,
                  target,
                  status,
                  claimed_at,
                  completed_at,
                  current_phase,
                  max_phase,
                  is_completed
    `, [achievement.player_achievement_id]);

    return updatedResult.rows[0];
}

async function claimAchievement(playerId, achievementId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await ensurePlayerAchievements(playerId, client);

        const achievement = await getClaimableAchievement(client, playerId, achievementId);
        assertCanClaimAchievement(achievement);

        const currentPhase = Number(achievement.current_phase || 1);
        await assertPhaseWasNotClaimed(client, playerId, achievementId, currentPhase);

        const rewardSnapshot = normalizeRewardKeys(achievement.phase_reward);
        const userCurrency = await applyRewardsToPlayer(client, playerId, [rewardSnapshot]);

        await client.query(`
            INSERT INTO public.achievement_claim_logs
                (player_id, achievement_id, phase, reward_snapshot, claimed_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [playerId, achievementId, currentPhase, rewardSnapshot]);

        await statisticsService.recordAchievementClaimed(playerId, {
            achievementId,
            phase: currentPhase,
            points: Number(achievement.phase_points || 0),
            isFinalPhase: currentPhase >= Number(achievement.player_max_phase || achievement.definition_max_phase || 1),
            isSecret: Boolean(achievement.is_secret)
        }, client);

        const updatedAchievement = await updateAchievementAfterClaim(client, achievement);

        await client.query('COMMIT');

        return {
            success: true,
            message: 'Recompensa reclamada correctamente.',
            userCurrency,
            achievement: {
                id: Number(updatedAchievement.id),
                status: updatedAchievement.status,
                claimedAt: updatedAchievement.claimed_at,
                completedAt: updatedAchievement.completed_at,
                currentPhase: Number(updatedAchievement.current_phase || 1),
                maxPhase: Number(updatedAchievement.max_phase || 1),
                isCompleted: Boolean(updatedAchievement.is_completed),
                progress: Number(updatedAchievement.progress || 0),
                target: Number(updatedAchievement.target || 0)
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
                pa.current_phase,
                pa.max_phase AS player_max_phase,
                ad.id AS achievement_id,
                ad.is_secret,
                ad.max_phase AS definition_max_phase,
                COALESCE(ap.points, ad.points) AS phase_points,
                COALESCE(ap.reward, ad.reward) AS phase_reward,
                next_ap.target AS next_phase_target
            FROM public.player_achievements pa
            JOIN public.achievement_definitions ad
              ON ad.id = pa.achievement_id
            LEFT JOIN public.achievement_phases ap
              ON ap.achievement_id = ad.id
             AND ap.phase = pa.current_phase
            LEFT JOIN public.achievement_phases next_ap
              ON next_ap.achievement_id = ad.id
             AND next_ap.phase = pa.current_phase + 1
            WHERE pa.player_id = $1
              AND pa.status = 'Reclamable'
              AND ad.is_active = true
              AND ad.season_code = $2
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.achievement_claim_logs acl
                  WHERE acl.player_id = pa.player_id
                    AND acl.achievement_id = pa.achievement_id
                    AND acl.phase = pa.current_phase
              )
            ORDER BY ad.sort_order ASC, ad.id ASC
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

        const rewardSnapshots = claimableAchievements.map((achievement) => normalizeRewardKeys(achievement.phase_reward));
        const userCurrency = await applyRewardsToPlayer(client, playerId, rewardSnapshots);

        for (const achievement of claimableAchievements) {
            const currentPhase = Number(achievement.current_phase || 1);
            await client.query(`
                INSERT INTO public.achievement_claim_logs
                    (player_id, achievement_id, phase, reward_snapshot, claimed_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (player_id, achievement_id, phase) DO NOTHING
            `, [
                playerId,
                achievement.achievement_id,
                currentPhase,
                normalizeRewardKeys(achievement.phase_reward)
            ]);

            await statisticsService.recordAchievementClaimed(playerId, {
                achievementId: achievement.achievement_id,
                phase: currentPhase,
                points: Number(achievement.phase_points || 0),
                isFinalPhase: currentPhase >= Number(achievement.player_max_phase || achievement.definition_max_phase || 1),
                isSecret: Boolean(achievement.is_secret)
            }, client);

            await updateAchievementAfterClaim(client, achievement);
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
                ad.conditions,
                pa.id AS player_achievement_id,
                pa.progress,
                pa.target AS player_target,
                pa.status,
                pa.completed_at,
                pa.is_completed,
                pa.current_phase,
                pa.max_phase,
                COALESCE(ap.target, ad.target) AS phase_target
            FROM public.player_achievements pa
            JOIN public.achievement_definitions ad
              ON ad.id = pa.achievement_id
            LEFT JOIN public.achievement_phases ap
              ON ap.achievement_id = ad.id
             AND ap.phase = pa.current_phase
            WHERE pa.player_id = $1
              AND ad.event_type = $2
              AND ad.is_active = true
              AND ad.season_code = $3
            ORDER BY ad.sort_order ASC, ad.id ASC
            FOR UPDATE OF pa
        `, [playerId, normalizedEventType, ACTIVE_SEASON_CODE]);

        const updated = [];
        for (const row of result.rows) {
            if (row.status === 'Reclamado' && row.is_completed === true) continue;
            if (row.status === 'Reclamable') continue;
            if (row.status === 'Bloqueado') continue;
            if (!matchesConditions(row.conditions, metadata)) continue;

            const target = Number(row.player_target || row.phase_target || 0);
            const currentProgress = Number(row.progress || 0);
            const nextProgress = target > 0
                ? Math.min(currentProgress + safeAmount, target)
                : currentProgress + safeAmount;
            const isComplete = target > 0 && nextProgress >= target;
            const nextStatus = isComplete
                ? 'Reclamable'
                : row.status === 'Oculto'
                    ? 'Oculto'
                    : 'En progreso';
            const shouldSetCompletedAt = isComplete && !row.completed_at;

            const updateResult = await client.query(`
                UPDATE public.player_achievements
                SET progress = $1,
                    target = $2,
                    status = $3,
                    completed_at = CASE WHEN $4 THEN NOW() ELSE completed_at END,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING achievement_id AS id,
                          progress,
                          target,
                          status,
                          current_phase,
                          max_phase,
                          is_completed
            `, [
                nextProgress,
                target,
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
                status: updatedRow.status,
                currentPhase: Number(updatedRow.current_phase || 1),
                maxPhase: Number(updatedRow.max_phase || 1),
                isCompleted: Boolean(updatedRow.is_completed)
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
