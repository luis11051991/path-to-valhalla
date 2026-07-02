const pool = require('../config/db');

let schemaEnsured = false;

const STATISTICS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS public.player_statistics (
    player_id UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
    battles_total BIGINT NOT NULL DEFAULT 0,
    battles_won BIGINT NOT NULL DEFAULT 0,
    battles_lost BIGINT NOT NULL DEFAULT 0,
    current_win_streak INTEGER NOT NULL DEFAULT 0,
    best_win_streak INTEGER NOT NULL DEFAULT 0,
    current_lose_streak INTEGER NOT NULL DEFAULT 0,
    best_lose_streak INTEGER NOT NULL DEFAULT 0,
    expeditions_completed BIGINT NOT NULL DEFAULT 0,
    expedition_wins BIGINT NOT NULL DEFAULT 0,
    expedition_losses BIGINT NOT NULL DEFAULT 0,
    mobs_killed BIGINT NOT NULL DEFAULT 0,
    bosses_killed BIGINT NOT NULL DEFAULT 0,
    hidden_mobs_killed BIGINT NOT NULL DEFAULT 0,
    difficulty_1_kills BIGINT NOT NULL DEFAULT 0,
    difficulty_2_kills BIGINT NOT NULL DEFAULT 0,
    difficulty_3_kills BIGINT NOT NULL DEFAULT 0,
    bestiary_discovered BIGINT NOT NULL DEFAULT 0,
    pvp_attacks_done BIGINT NOT NULL DEFAULT 0,
    pvp_attacks_received BIGINT NOT NULL DEFAULT 0,
    pvp_wins_attacking BIGINT NOT NULL DEFAULT 0,
    pvp_losses_attacking BIGINT NOT NULL DEFAULT 0,
    pvp_wins_defending BIGINT NOT NULL DEFAULT 0,
    pvp_losses_defending BIGINT NOT NULL DEFAULT 0,
    revenge_wins BIGINT NOT NULL DEFAULT 0,
    revenge_losses BIGINT NOT NULL DEFAULT 0,
    copper_earned_total BIGINT NOT NULL DEFAULT 0,
    silver_earned_total BIGINT NOT NULL DEFAULT 0,
    gold_earned_total BIGINT NOT NULL DEFAULT 0,
    onix_earned_total BIGINT NOT NULL DEFAULT 0,
    copper_spent_total BIGINT NOT NULL DEFAULT 0,
    silver_spent_total BIGINT NOT NULL DEFAULT 0,
    gold_spent_total BIGINT NOT NULL DEFAULT 0,
    onix_spent_total BIGINT NOT NULL DEFAULT 0,
    copper_stolen_total BIGINT NOT NULL DEFAULT 0,
    silver_stolen_total BIGINT NOT NULL DEFAULT 0,
    gold_stolen_total BIGINT NOT NULL DEFAULT 0,
    copper_lost_total BIGINT NOT NULL DEFAULT 0,
    silver_lost_total BIGINT NOT NULL DEFAULT 0,
    gold_lost_total BIGINT NOT NULL DEFAULT 0,
    biggest_robbery_copper_value BIGINT NOT NULL DEFAULT 0,
    biggest_loss_copper_value BIGINT NOT NULL DEFAULT 0,
    copper_deposited_total BIGINT NOT NULL DEFAULT 0,
    silver_deposited_total BIGINT NOT NULL DEFAULT 0,
    gold_deposited_total BIGINT NOT NULL DEFAULT 0,
    copper_withdrawn_total BIGINT NOT NULL DEFAULT 0,
    silver_withdrawn_total BIGINT NOT NULL DEFAULT 0,
    gold_withdrawn_total BIGINT NOT NULL DEFAULT 0,
    inventory_items_count BIGINT NOT NULL DEFAULT 0,
    equipped_items_count BIGINT NOT NULL DEFAULT 0,
    inventory_total_value_copper BIGINT NOT NULL DEFAULT 0,
    equipped_total_value_copper BIGINT NOT NULL DEFAULT 0,
    account_estimated_value_copper BIGINT NOT NULL DEFAULT 0,
    most_valuable_item_id BIGINT,
    most_valuable_item_name TEXT,
    most_valuable_item_value_copper BIGINT NOT NULL DEFAULT 0,
    achievements_completed BIGINT NOT NULL DEFAULT 0,
    achievement_phases_completed BIGINT NOT NULL DEFAULT 0,
    achievement_points_total BIGINT NOT NULL DEFAULT 0,
    achievement_rewards_claimed BIGINT NOT NULL DEFAULT 0,
    secret_achievements_discovered BIGINT NOT NULL DEFAULT 0,
    quests_completed BIGINT NOT NULL DEFAULT 0,
    daily_quests_completed BIGINT NOT NULL DEFAULT 0,
    weekly_quests_completed BIGINT NOT NULL DEFAULT 0,
    grimoire_powers_equipped BIGINT NOT NULL DEFAULT 0,
    grimoire_powers_upgraded BIGINT NOT NULL DEFAULT 0,
    pets_unlocked BIGINT NOT NULL DEFAULT 0,
    pets_fed_total BIGINT NOT NULL DEFAULT 0,
    recipes_learned_total BIGINT NOT NULL DEFAULT 0,
    profession_actions_total BIGINT NOT NULL DEFAULT 0,
    last_battle_at TIMESTAMPTZ,
    last_win_at TIMESTAMPTZ,
    last_loss_at TIMESTAMPTZ,
    last_boss_kill_at TIMESTAMPTZ,
    last_hidden_kill_at TIMESTAMPTZ,
    last_quest_completed_at TIMESTAMPTZ,
    last_achievement_claimed_at TIMESTAMPTZ,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
)`;

function toNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}

function toCopperValue({ copper = 0, silver = 0, gold = 0 } = {}) {
    return toNumber(copper) + (toNumber(silver) * 100) + (toNumber(gold) * 10000);
}

function formatCurrencyFromCopper(value) {
    const safeValue = Math.max(0, Math.trunc(toNumber(value)));
    const gold = Math.floor(safeValue / 10000);
    const restAfterGold = safeValue % 10000;
    const silver = Math.floor(restAfterGold / 100);
    const copper = restAfterGold % 100;

    return { gold, silver, copper };
}

function formatCurrencyLabel(value) {
    const { gold, silver, copper } = formatCurrencyFromCopper(value);
    const parts = [];
    if (gold > 0) parts.push(`${gold} oro`);
    if (silver > 0) parts.push(`${silver} plata`);
    if (copper > 0 || parts.length === 0) parts.push(`${copper} cobre`);
    return parts.join(' ');
}

function normalizeReward(reward = {}) {
    if (!reward || typeof reward !== 'object' || Array.isArray(reward)) return {};
    return {
        copper: toNumber(reward.copper),
        silver: toNumber(reward.silver),
        gold: toNumber(reward.gold),
        onix: toNumber(reward.onix || reward.onyx)
    };
}

async function ensureStatisticsSchema(client) {
    if (schemaEnsured) return;
    await client.query(STATISTICS_SCHEMA_SQL);
    schemaEnsured = true;
}

async function ensurePlayerStatistics(playerId, client = pool) {
    await ensureStatisticsSchema(client);
    await client.query(`
        INSERT INTO public.player_statistics (player_id)
        VALUES ($1)
        ON CONFLICT (player_id) DO NOTHING
    `, [playerId]);
}

async function withTransaction(externalClient, callback) {
    const client = externalClient || await pool.connect();
    const ownsTransaction = !externalClient;

    try {
        if (ownsTransaction) await client.query('BEGIN');
        const result = await callback(client);
        if (ownsTransaction) await client.query('COMMIT');
        return result;
    } catch (error) {
        if (ownsTransaction) await client.query('ROLLBACK');
        throw error;
    } finally {
        if (ownsTransaction) client.release();
    }
}

async function recalculateInventoryStats(playerId, client = pool) {
    await ensurePlayerStatistics(playerId, client);

    await client.query(`
        WITH item_values AS (
            SELECT
                pi.id,
                COALESCE(pi.is_equipped, false) AS is_equipped,
                it.name,
                GREATEST(COALESCE(pi.quantity, 1), 1) * GREATEST(COALESCE(it.price_copper, 0), 0) AS copper_value
            FROM public.player_items pi
            LEFT JOIN public.items_templates it
              ON it.id = pi.template_id
            WHERE pi.player_id = $1
        ),
        totals AS (
            SELECT
                COALESCE(COUNT(*) FILTER (WHERE is_equipped = false), 0) AS inventory_items_count,
                COALESCE(COUNT(*) FILTER (WHERE is_equipped = true), 0) AS equipped_items_count,
                COALESCE(SUM(copper_value) FILTER (WHERE is_equipped = false), 0) AS inventory_total_value_copper,
                COALESCE(SUM(copper_value) FILTER (WHERE is_equipped = true), 0) AS equipped_total_value_copper
            FROM item_values
        ),
        most_valuable AS (
            SELECT id, name, copper_value
            FROM item_values
            ORDER BY copper_value DESC, id ASC
            LIMIT 1
        ),
        player_money AS (
            SELECT
                COALESCE(copper, 0)
                + COALESCE(silver, 0) * 100
                + COALESCE(gold, 0) * 10000
                + COALESCE(bank_copper, 0)
                + COALESCE(bank_silver, 0) * 100
                + COALESCE(bank_gold, 0) * 10000 AS copper_value
            FROM public.players
            WHERE id = $1
        )
        UPDATE public.player_statistics ps
        SET inventory_items_count = totals.inventory_items_count,
            equipped_items_count = totals.equipped_items_count,
            inventory_total_value_copper = totals.inventory_total_value_copper,
            equipped_total_value_copper = totals.equipped_total_value_copper,
            account_estimated_value_copper =
                totals.inventory_total_value_copper
                + totals.equipped_total_value_copper
                + COALESCE(player_money.copper_value, 0),
            most_valuable_item_id = most_valuable.id,
            most_valuable_item_name = most_valuable.name,
            most_valuable_item_value_copper = COALESCE(most_valuable.copper_value, 0)
        FROM totals
        CROSS JOIN player_money
        LEFT JOIN most_valuable ON true
        WHERE ps.player_id = $1
    `, [playerId]);
}

async function recalculateDerivedProgressStats(playerId, client) {
    await ensurePlayerStatistics(playerId, client);

    await client.query(`
        WITH derived AS (
            SELECT
                (SELECT COUNT(*) FROM public.player_bestiary pb WHERE pb.player_id = $1) AS bestiary_discovered,
                (
                    SELECT COUNT(*)
                    FROM public.player_quests pq
                    WHERE pq.player_id = $1
                      AND pq.status = 'completed'
                ) AS quests_completed,
                (
                    SELECT COUNT(*)
                    FROM public.player_quests pq
                    JOIN public.quests q ON q.id = pq.quest_id
                    WHERE pq.player_id = $1
                      AND pq.status = 'completed'
                      AND q.type = 'daily'
                ) AS daily_quests_completed,
                (
                    SELECT COUNT(*)
                    FROM public.player_quests pq
                    JOIN public.quests q ON q.id = pq.quest_id
                    WHERE pq.player_id = $1
                      AND pq.status = 'completed'
                      AND q.type = 'weekly'
                ) AS weekly_quests_completed,
                (
                    SELECT MAX(pq.completed_at)::timestamptz
                    FROM public.player_quests pq
                    WHERE pq.player_id = $1
                      AND pq.status = 'completed'
                ) AS last_quest_completed_at,
                (
                    SELECT COUNT(*)
                    FROM public.player_achievements pa
                    WHERE pa.player_id = $1
                      AND (pa.is_completed = true OR pa.status = 'Reclamado')
                ) AS achievements_completed,
                (
                    SELECT COUNT(*)
                    FROM public.achievement_claim_logs acl
                    WHERE acl.player_id = $1
                ) AS achievement_phases_completed,
                (
                    SELECT COALESCE(SUM(COALESCE(ap.points, ad.points, 0)), 0)
                    FROM public.achievement_claim_logs acl
                    JOIN public.achievement_definitions ad
                      ON ad.id = acl.achievement_id
                    LEFT JOIN public.achievement_phases ap
                      ON ap.achievement_id = acl.achievement_id
                     AND ap.phase = acl.phase
                    WHERE acl.player_id = $1
                ) AS achievement_points_total,
                (
                    SELECT COUNT(*)
                    FROM public.achievement_claim_logs acl
                    WHERE acl.player_id = $1
                ) AS achievement_rewards_claimed,
                (
                    SELECT COUNT(DISTINCT acl.achievement_id)
                    FROM public.achievement_claim_logs acl
                    JOIN public.achievement_definitions ad
                      ON ad.id = acl.achievement_id
                    WHERE acl.player_id = $1
                      AND ad.is_secret = true
                ) AS secret_achievements_discovered,
                (
                    SELECT MAX(acl.claimed_at)
                    FROM public.achievement_claim_logs acl
                    WHERE acl.player_id = $1
                ) AS last_achievement_claimed_at,
                (
                    SELECT COUNT(*)
                    FROM public.player_skills ps
                    WHERE ps.player_id = $1
                      AND ps.is_equipped = true
                ) AS grimoire_powers_equipped,
                (
                    SELECT COALESCE(SUM(GREATEST(COALESCE(ps.skill_level, 1) - 1, 0)), 0)
                    FROM public.player_skills ps
                    WHERE ps.player_id = $1
                ) AS grimoire_powers_upgraded,
                (
                    SELECT COUNT(DISTINCT pp.pet_id)
                    FROM public.player_pets pp
                    WHERE pp.player_id = $1
                ) AS pets_unlocked,
                (
                    SELECT CASE
                        WHEN jsonb_typeof(COALESCE(p.learned_recipes, '[]'::jsonb)) = 'array'
                            THEN jsonb_array_length(COALESCE(p.learned_recipes, '[]'::jsonb))
                        ELSE 0
                    END
                    FROM public.players p
                    WHERE p.id = $1
                ) AS recipes_learned_total
        )
        UPDATE public.player_statistics ps
        SET bestiary_discovered = COALESCE(derived.bestiary_discovered, 0),
            quests_completed = COALESCE(derived.quests_completed, 0),
            daily_quests_completed = COALESCE(derived.daily_quests_completed, 0),
            weekly_quests_completed = COALESCE(derived.weekly_quests_completed, 0),
            last_quest_completed_at = COALESCE(derived.last_quest_completed_at, ps.last_quest_completed_at),
            achievements_completed = COALESCE(derived.achievements_completed, 0),
            achievement_phases_completed = COALESCE(derived.achievement_phases_completed, 0),
            achievement_points_total = COALESCE(derived.achievement_points_total, 0),
            achievement_rewards_claimed = COALESCE(derived.achievement_rewards_claimed, 0),
            secret_achievements_discovered = COALESCE(derived.secret_achievements_discovered, 0),
            last_achievement_claimed_at = COALESCE(derived.last_achievement_claimed_at, ps.last_achievement_claimed_at),
            grimoire_powers_equipped = COALESCE(derived.grimoire_powers_equipped, 0),
            grimoire_powers_upgraded = COALESCE(derived.grimoire_powers_upgraded, 0),
            pets_unlocked = COALESCE(derived.pets_unlocked, 0),
            recipes_learned_total = COALESCE(derived.recipes_learned_total, 0)
        FROM derived
        WHERE ps.player_id = $1
    `, [playerId]);
}

function buildStatisticsResponse(row, player) {
    const battlesTotal = toNumber(row.battles_total);
    const battlesWon = toNumber(row.battles_won);
    const battlesLost = toNumber(row.battles_lost);
    const winRate = battlesTotal > 0 ? Number(((battlesWon / battlesTotal) * 100).toFixed(1)) : 0;
    const inventoryValue = toNumber(row.inventory_total_value_copper);
    const accountValue = toNumber(row.account_estimated_value_copper);

    return {
        success: true,
        summary: {
            battlesWon,
            battlesLost,
            winRate,
            achievementsCompleted: toNumber(row.achievements_completed),
            achievementPhasesCompleted: toNumber(row.achievement_phases_completed),
            inventoryValue: {
                copperValue: inventoryValue,
                formatted: formatCurrencyLabel(inventoryValue)
            },
            accountValue: {
                copperValue: accountValue,
                formatted: formatCurrencyLabel(accountValue)
            }
        },
        combat: {
            battlesTotal,
            battlesWon,
            battlesLost,
            winRate,
            currentWinStreak: toNumber(row.current_win_streak),
            bestWinStreak: toNumber(row.best_win_streak),
            currentLoseStreak: toNumber(row.current_lose_streak),
            bestLoseStreak: toNumber(row.best_lose_streak),
            expeditionsCompleted: toNumber(row.expeditions_completed),
            expeditionWins: toNumber(row.expedition_wins),
            expeditionLosses: toNumber(row.expedition_losses),
            mobsKilled: toNumber(row.mobs_killed),
            bossesKilled: toNumber(row.bosses_killed),
            hiddenMobsKilled: toNumber(row.hidden_mobs_killed),
            difficultyKills: {
                common: toNumber(row.difficulty_1_kills),
                rare: toNumber(row.difficulty_2_kills),
                legendary: toNumber(row.difficulty_3_kills)
            }
        },
        economy: {
            current: {
                copper: toNumber(player.copper),
                silver: toNumber(player.silver),
                gold: toNumber(player.gold),
                onix: toNumber(player.onix)
            },
            bank: {
                copper: toNumber(player.bank_copper),
                silver: toNumber(player.bank_silver),
                gold: toNumber(player.bank_gold)
            },
            earned: {
                copper: toNumber(row.copper_earned_total),
                silver: toNumber(row.silver_earned_total),
                gold: toNumber(row.gold_earned_total),
                onix: toNumber(row.onix_earned_total)
            },
            spent: {
                copper: toNumber(row.copper_spent_total),
                silver: toNumber(row.silver_spent_total),
                gold: toNumber(row.gold_spent_total),
                onix: toNumber(row.onix_spent_total)
            },
            stolen: {
                copper: toNumber(row.copper_stolen_total),
                silver: toNumber(row.silver_stolen_total),
                gold: toNumber(row.gold_stolen_total)
            },
            lost: {
                copper: toNumber(row.copper_lost_total),
                silver: toNumber(row.silver_lost_total),
                gold: toNumber(row.gold_lost_total)
            },
            deposited: {
                copper: toNumber(row.copper_deposited_total),
                silver: toNumber(row.silver_deposited_total),
                gold: toNumber(row.gold_deposited_total)
            },
            withdrawn: {
                copper: toNumber(row.copper_withdrawn_total),
                silver: toNumber(row.silver_withdrawn_total),
                gold: toNumber(row.gold_withdrawn_total)
            },
            biggestRobberyCopperValue: toNumber(row.biggest_robbery_copper_value),
            biggestLossCopperValue: toNumber(row.biggest_loss_copper_value)
        },
        inventory: {
            itemsCount: toNumber(row.inventory_items_count),
            equippedItemsCount: toNumber(row.equipped_items_count),
            inventoryValueCopper: inventoryValue,
            equippedValueCopper: toNumber(row.equipped_total_value_copper),
            accountEstimatedValueCopper: accountValue,
            mostValuableItem: row.most_valuable_item_id ? {
                id: Number(row.most_valuable_item_id),
                name: row.most_valuable_item_name,
                copperValue: toNumber(row.most_valuable_item_value_copper),
                formatted: formatCurrencyLabel(row.most_valuable_item_value_copper)
            } : null
        },
        progress: {
            achievementsCompleted: toNumber(row.achievements_completed),
            achievementPhasesCompleted: toNumber(row.achievement_phases_completed),
            achievementPointsTotal: toNumber(row.achievement_points_total),
            achievementRewardsClaimed: toNumber(row.achievement_rewards_claimed),
            secretAchievementsDiscovered: toNumber(row.secret_achievements_discovered),
            bestiaryDiscovered: toNumber(row.bestiary_discovered),
            questsCompleted: toNumber(row.quests_completed),
            dailyQuestsCompleted: toNumber(row.daily_quests_completed),
            weeklyQuestsCompleted: toNumber(row.weekly_quests_completed),
            grimoirePowersEquipped: toNumber(row.grimoire_powers_equipped),
            grimoirePowersUpgraded: toNumber(row.grimoire_powers_upgraded),
            petsUnlocked: toNumber(row.pets_unlocked),
            petsFedTotal: toNumber(row.pets_fed_total),
            recipesLearnedTotal: toNumber(row.recipes_learned_total),
            professionActionsTotal: toNumber(row.profession_actions_total)
        },
        pvp: {
            attacksDone: toNumber(row.pvp_attacks_done),
            attacksReceived: toNumber(row.pvp_attacks_received),
            winsAttacking: toNumber(row.pvp_wins_attacking),
            lossesAttacking: toNumber(row.pvp_losses_attacking),
            winsDefending: toNumber(row.pvp_wins_defending),
            lossesDefending: toNumber(row.pvp_losses_defending),
            revengeWins: toNumber(row.revenge_wins),
            revengeLosses: toNumber(row.revenge_losses),
            stolen: {
                copper: toNumber(row.copper_stolen_total),
                silver: toNumber(row.silver_stolen_total),
                gold: toNumber(row.gold_stolen_total)
            },
            lost: {
                copper: toNumber(row.copper_lost_total),
                silver: toNumber(row.silver_lost_total),
                gold: toNumber(row.gold_lost_total)
            }
        },
        recent: {
            lastBattleAt: row.last_battle_at || null,
            lastWinAt: row.last_win_at || null,
            lastLossAt: row.last_loss_at || null,
            lastBossKillAt: row.last_boss_kill_at || null,
            lastHiddenKillAt: row.last_hidden_kill_at || null,
            lastQuestCompletedAt: row.last_quest_completed_at || null,
            lastAchievementClaimedAt: row.last_achievement_claimed_at || null
        }
    };
}

async function getPlayerStatistics(playerId) {
    return withTransaction(null, async (client) => {
        await ensurePlayerStatistics(playerId, client);
        await recalculateInventoryStats(playerId, client);
        await recalculateDerivedProgressStats(playerId, client);

        const result = await client.query(`
            SELECT ps.*, p.copper, p.silver, p.gold, p.onix, p.bank_copper, p.bank_silver, p.bank_gold
            FROM public.player_statistics ps
            JOIN public.players p
              ON p.id = ps.player_id
            WHERE ps.player_id = $1
        `, [playerId]);

        if (result.rows.length === 0) {
            const error = new Error('Jugador no encontrado.');
            error.statusCode = 404;
            throw error;
        }

        return buildStatisticsResponse(result.rows[0], result.rows[0]);
    });
}

async function recordExpeditionBattle(playerId, battleData = {}, externalClient = null) {
    return withTransaction(externalClient, async (client) => {
        await ensurePlayerStatistics(playerId, client);

        const enemy = battleData.enemy || {};
        const rewards = normalizeReward(battleData.rewards || {});
        const isWin = Boolean(battleData.isWin);
        const difficultyTier = Number(enemy.difficulty_tier || 0);

        await client.query(`
            UPDATE public.player_statistics
            SET battles_total = battles_total + 1,
                battles_won = battles_won + CASE WHEN $2 THEN 1 ELSE 0 END,
                battles_lost = battles_lost + CASE WHEN $2 THEN 0 ELSE 1 END,
                expedition_wins = expedition_wins + CASE WHEN $2 THEN 1 ELSE 0 END,
                expedition_losses = expedition_losses + CASE WHEN $2 THEN 0 ELSE 1 END,
                expeditions_completed = expeditions_completed + CASE WHEN $2 THEN 1 ELSE 0 END,
                mobs_killed = mobs_killed + CASE WHEN $2 THEN 1 ELSE 0 END,
                bosses_killed = bosses_killed + CASE WHEN $2 AND $3 THEN 1 ELSE 0 END,
                hidden_mobs_killed = hidden_mobs_killed + CASE WHEN $2 AND $4 THEN 1 ELSE 0 END,
                difficulty_1_kills = difficulty_1_kills + CASE WHEN $2 AND $5 = 1 THEN 1 ELSE 0 END,
                difficulty_2_kills = difficulty_2_kills + CASE WHEN $2 AND $5 = 2 THEN 1 ELSE 0 END,
                difficulty_3_kills = difficulty_3_kills + CASE WHEN $2 AND $5 = 3 THEN 1 ELSE 0 END,
                bestiary_discovered = bestiary_discovered + CASE WHEN $2 AND $6 THEN 1 ELSE 0 END,
                current_win_streak = CASE WHEN $2 THEN current_win_streak + 1 ELSE 0 END,
                best_win_streak = CASE WHEN $2 THEN GREATEST(best_win_streak, current_win_streak + 1) ELSE best_win_streak END,
                current_lose_streak = CASE WHEN $2 THEN 0 ELSE current_lose_streak + 1 END,
                best_lose_streak = CASE WHEN $2 THEN best_lose_streak ELSE GREATEST(best_lose_streak, current_lose_streak + 1) END,
                copper_earned_total = copper_earned_total + $7,
                silver_earned_total = silver_earned_total + $8,
                gold_earned_total = gold_earned_total + $9,
                onix_earned_total = onix_earned_total + $10,
                last_battle_at = NOW(),
                last_win_at = CASE WHEN $2 THEN NOW() ELSE last_win_at END,
                last_loss_at = CASE WHEN $2 THEN last_loss_at ELSE NOW() END,
                last_boss_kill_at = CASE WHEN $2 AND $3 THEN NOW() ELSE last_boss_kill_at END,
                last_hidden_kill_at = CASE WHEN $2 AND $4 THEN NOW() ELSE last_hidden_kill_at END
            WHERE player_id = $1
        `, [
            playerId,
            isWin,
            Boolean(enemy.is_boss),
            Boolean(enemy.is_hidden),
            difficultyTier,
            Boolean(battleData.isNewBestiaryEntry),
            rewards.copper,
            rewards.silver,
            rewards.gold,
            rewards.onix
        ]);
    });
}

async function recordQuestCompleted(playerId, questData = {}, externalClient = null) {
    return withTransaction(externalClient, async (client) => {
        await ensurePlayerStatistics(playerId, client);

        const rewards = normalizeReward(questData.rewards || {});
        const questType = String(questData.type || '').toLowerCase();

        await client.query(`
            UPDATE public.player_statistics
            SET quests_completed = quests_completed + 1,
                daily_quests_completed = daily_quests_completed + CASE WHEN $2 = 'daily' THEN 1 ELSE 0 END,
                weekly_quests_completed = weekly_quests_completed + CASE WHEN $2 = 'weekly' THEN 1 ELSE 0 END,
                copper_earned_total = copper_earned_total + $3,
                silver_earned_total = silver_earned_total + $4,
                gold_earned_total = gold_earned_total + $5,
                onix_earned_total = onix_earned_total + $6,
                last_quest_completed_at = NOW()
            WHERE player_id = $1
        `, [
            playerId,
            questType,
            rewards.copper,
            rewards.silver,
            rewards.gold,
            rewards.onix
        ]);
    });
}

async function recordAchievementClaimed(playerId, achievementData = {}, externalClient = null) {
    return withTransaction(externalClient, async (client) => {
        await ensurePlayerStatistics(playerId, client);

        const isSecret = Boolean(achievementData.isSecret);
        let secretIncrement = 0;

        if (isSecret && achievementData.achievementId) {
            const secretClaimResult = await client.query(`
                SELECT COUNT(*) AS claim_count
                FROM public.achievement_claim_logs
                WHERE player_id = $1
                  AND achievement_id = $2
            `, [playerId, achievementData.achievementId]);

            secretIncrement = toNumber(secretClaimResult.rows[0]?.claim_count) <= 1 ? 1 : 0;
        }

        await client.query(`
            UPDATE public.player_statistics
            SET achievement_rewards_claimed = achievement_rewards_claimed + 1,
                achievement_phases_completed = achievement_phases_completed + 1,
                achievement_points_total = achievement_points_total + $2,
                achievements_completed = achievements_completed + CASE WHEN $3 THEN 1 ELSE 0 END,
                secret_achievements_discovered = secret_achievements_discovered + $4,
                last_achievement_claimed_at = NOW()
            WHERE player_id = $1
        `, [
            playerId,
            toNumber(achievementData.points),
            Boolean(achievementData.isFinalPhase),
            secretIncrement
        ]);
    });
}

module.exports = {
    getPlayerStatistics,
    ensurePlayerStatistics,
    recalculateInventoryStats,
    recordExpeditionBattle,
    recordQuestCompleted,
    recordAchievementClaimed,
    toCopperValue,
    formatCurrencyFromCopper
};
