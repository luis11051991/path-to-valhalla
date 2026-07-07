const pool = require('../config/db');

const JOIN_TYPES = new Set(['open', 'request', 'closed']);
const ROLES = {
    leader: 'leader',
    admin: 'admin',
    member: 'member'
};

const INITIAL_UNLOCKED_BUILDINGS = new Set([
    'alliance_bank',
    'training_field',
    'great_hall',
    'valhallus_sanctuary'
]);

const COPPER_PER_SILVER = 100;
const COPPER_PER_GOLD = 10000;

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

const toNumber = (value) => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
};

const toInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function toCopperValue(money = {}) {
    return (toNumber(money.gold) * COPPER_PER_GOLD)
        + (toNumber(money.silver) * COPPER_PER_SILVER)
        + toNumber(money.copper);
}

function fromCopperValue(value = 0) {
    const normalized = Math.max(0, toNumber(value));
    const gold = Math.floor(normalized / COPPER_PER_GOLD);
    const silver = Math.floor((normalized % COPPER_PER_GOLD) / COPPER_PER_SILVER);
    const copper = normalized % COPPER_PER_SILVER;
    return { gold, silver, copper };
}

function formatCurrencyFromCopper(value = 0) {
    const money = fromCopperValue(value);
    const parts = [];
    if (money.gold) parts.push(`${money.gold} oro`);
    if (money.silver) parts.push(`${money.silver} plata`);
    if (money.copper || parts.length === 0) parts.push(`${money.copper} cobre`);
    return parts.join(', ');
}

const normalizeNullableText = (value, maxLength = 500) => {
    if (value === undefined || value === null) return null;
    return String(value).trim().slice(0, maxLength);
};

const normalizeRequiredText = (value, label, maxLength = 500) => {
    const normalized = normalizeNullableText(value, maxLength);
    if (!normalized) throw httpError(400, `${label} es requerido.`);
    return normalized;
};

const normalizeTag = (value) => {
    const normalized = normalizeNullableText(value, 8);
    return normalized ? normalized.toUpperCase() : null;
};

const normalizeJoinType = (value, fallback = 'request') => {
    const normalized = String(value || fallback).toLowerCase();
    if (!JOIN_TYPES.has(normalized)) {
        throw httpError(400, 'Tipo de ingreso invalido.');
    }
    return normalized;
};

const normalizeMoney = (payload = {}) => {
    const money = {
        copper: toInt(payload.copper, 0),
        silver: toInt(payload.silver, 0),
        gold: toInt(payload.gold, 0),
        onix: toInt(payload.onix, 0)
    };

    if (Object.values(money).some((value) => value < 0)) {
        throw httpError(400, 'Las cantidades deben ser enteros mayores o iguales a 0.');
    }

    if (Object.values(money).every((value) => value === 0)) {
        throw httpError(400, 'Debes donar al menos una moneda.');
    }

    return money;
};

async function withTransaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

function getAlliancePermissions(role) {
    if (role === ROLES.leader) {
        return {
            editAlliance: true,
            manageApplications: true,
            manageMembers: true,
            promoteMembers: true,
            demoteMembers: true,
            kickMembers: true,
            upgradeBuildings: true,
            transferLeadership: true,
            disbandAlliance: true,
            donate: true,
            viewMembers: true,
            leaveAlliance: true,
            editMessage: true
        };
    }

    if (role === ROLES.admin) {
        return {
            editAlliance: false,
            manageApplications: true,
            manageMembers: true,
            promoteMembers: false,
            demoteMembers: false,
            kickMembers: true,
            upgradeBuildings: true,
            transferLeadership: false,
            disbandAlliance: false,
            donate: true,
            viewMembers: true,
            leaveAlliance: true,
            editMessage: true
        };
    }

    return {
        editAlliance: false,
        manageApplications: false,
        manageMembers: false,
        promoteMembers: false,
        demoteMembers: false,
        kickMembers: false,
        upgradeBuildings: false,
        transferLeadership: false,
        disbandAlliance: false,
        donate: true,
        viewMembers: true,
        leaveAlliance: true,
        editMessage: false
    };
}

async function getAllianceRole(playerId, allianceId, client = pool) {
    const result = await client.query(`
        SELECT role
        FROM alliance_members
        WHERE player_id = $1
          AND alliance_id = $2
          AND is_active = true
          AND left_at IS NULL
    `, [playerId, allianceId]);

    return result.rows[0]?.role || null;
}

async function getActiveMembership(playerId, client = pool, lock = false) {
    const result = await client.query(`
        SELECT
            am.*,
            a.name AS alliance_name,
            a.is_active AS alliance_is_active
        FROM alliance_members am
        JOIN alliances a ON a.id = am.alliance_id
        WHERE am.player_id = $1
          AND am.is_active = true
          AND am.left_at IS NULL
          AND a.is_active = true
        LIMIT 1
        ${lock ? 'FOR UPDATE OF am' : ''}
    `, [playerId]);

    return result.rows[0] || null;
}

async function requireActiveMembership(playerId, client = pool) {
    const membership = await getActiveMembership(playerId, client);
    if (!membership) throw httpError(400, 'Debes pertenecer a una alianza activa.');
    return membership;
}

function assertRole(role, allowedRoles, message = 'No tienes permisos para esta accion.') {
    if (!allowedRoles.includes(role)) throw httpError(403, message);
}

function mapMoney(row, prefix = '') {
    return {
        copper: toNumber(row[`${prefix}copper`]),
        silver: toNumber(row[`${prefix}silver`]),
        gold: toNumber(row[`${prefix}gold`]),
        onix: toNumber(row[`${prefix}onix`])
    };
}

function mapTreasury(row) {
    const copperValue = row.treasury_copper_balance === null || row.treasury_copper_balance === undefined
        ? toCopperValue({
            copper: row.treasury_copper,
            silver: row.treasury_silver,
            gold: row.treasury_gold
        })
        : toNumber(row.treasury_copper_balance);
    const money = fromCopperValue(copperValue);

    return {
        ...money,
        onix: row.treasury_onix_balance === null || row.treasury_onix_balance === undefined
            ? toNumber(row.treasury_onix)
            : toNumber(row.treasury_onix_balance),
        copperValue,
        display: formatCurrencyFromCopper(copperValue)
    };
}

function mapTotalDonated(row) {
    const copperValue = row.total_donated_copper_value === null || row.total_donated_copper_value === undefined
        ? toCopperValue({
            copper: row.total_donated_copper,
            silver: row.total_donated_silver,
            gold: row.total_donated_gold
        })
        : toNumber(row.total_donated_copper_value);
    const money = fromCopperValue(copperValue);

    return {
        ...money,
        onix: toNumber(row.total_donated_onix),
        copperValue,
        display: formatCurrencyFromCopper(copperValue)
    };
}

function mapAlliance(row) {
    return {
        id: String(row.id),
        name: row.name,
        tag: row.tag,
        description: row.description,
        messageOfTheDay: row.message_of_the_day,
        logoUrl: row.logo_url,
        bannerUrl: row.banner_url,
        leaderId: row.leader_id,
        leaderName: row.leader_name || null,
        level: toNumber(row.level),
        experience: toNumber(row.experience),
        membersCount: toNumber(row.members_count),
        maxMembers: toNumber(row.max_members),
        minLevelRequired: toNumber(row.min_level_required),
        minPowerRequired: toNumber(row.min_power_required),
        joinType: row.join_type,
        treasury: mapTreasury(row),
        totalDonated: mapTotalDonated(row),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function getEffectForLevel(levelEffects = [], level = 1) {
    if (!Array.isArray(levelEffects)) return {};
    const exact = levelEffects.find((effect) => Number(effect.level) === Number(level));
    if (exact) return exact;
    const available = levelEffects
        .filter((effect) => Number(effect.level) <= Number(level))
        .sort((left, right) => Number(right.level) - Number(left.level));
    return available[0] || {};
}

function getCostForLevel(upgradeCosts = [], level = 1) {
    if (!Array.isArray(upgradeCosts)) return null;
    return upgradeCosts.find((cost) => Number(cost.level) === Number(level)) || null;
}

function stripLevel(object = {}) {
    const { level, ...rest } = object || {};
    return rest;
}

function normalizeUpgradeCost(cost = {}) {
    if (!cost || Object.keys(cost).length === 0) return null;
    const copperValue = cost.copperValue !== undefined
        ? toNumber(cost.copperValue)
        : toCopperValue(cost);
    return {
        ...fromCopperValue(copperValue),
        copperValue,
        onix: toNumber(cost.onix),
        display: cost.display || formatCurrencyFromCopper(copperValue)
    };
}

function mapBuilding(row) {
    const currentEffect = stripLevel(getEffectForLevel(row.level_effects, row.level));
    const nextLevel = toNumber(row.level) + 1;
    const nextEffect = toNumber(row.level) < toNumber(row.max_level)
        ? stripLevel(getEffectForLevel(row.level_effects, nextLevel))
        : null;
    const nextUpgradeCost = toNumber(row.level) < toNumber(row.max_level)
        ? normalizeUpgradeCost(stripLevel(getCostForLevel(row.upgrade_costs, nextLevel) || {}))
        : null;

    return {
        id: String(row.id),
        allianceId: String(row.alliance_id),
        definitionId: String(row.building_definition_id),
        code: row.code,
        name: row.name,
        description: row.description,
        level: toNumber(row.level),
        maxLevel: toNumber(row.max_level),
        progress: toNumber(row.progress),
        isUnlocked: Boolean(row.is_unlocked),
        isFuture: Boolean(row.is_future),
        effectType: row.effect_type,
        imageUrl: row.image_url,
        backgroundUrl: row.background_url,
        levelImages: row.level_images || {},
        unlockRequirements: row.unlock_requirements || {},
        currentEffect,
        nextEffect,
        nextUpgradeCost,
        sortOrder: toNumber(row.sort_order)
    };
}

async function getBuildings(allianceId, client = pool) {
    const result = await client.query(`
        SELECT
            b.*,
            d.code,
            d.name,
            d.description,
            d.max_level,
            d.effect_type,
            d.base_effect,
            d.level_effects,
            d.upgrade_costs,
            d.unlock_requirements,
            d.image_url,
            d.background_url,
            d.level_images,
            d.sort_order,
            d.is_future
        FROM alliance_buildings b
        JOIN alliance_building_definitions d ON d.id = b.building_definition_id
        WHERE b.alliance_id = $1
          AND d.is_active = true
        ORDER BY d.sort_order ASC, d.id ASC
    `, [allianceId]);

    return result.rows.map(mapBuilding);
}

function buildBonuses(buildings = []) {
    const bonuses = {
        statsPercent: 0,
        expPercent: 0,
        maxMembers: 0,
        hiddenFindPercent: 0,
        workshopDiscountPercent: 0,
        treasuryCapacityBonusPercent: 0
    };

    buildings.forEach((building) => {
        if (!building.isUnlocked) return;
        Object.entries(building.currentEffect || {}).forEach(([key, value]) => {
            if (Object.prototype.hasOwnProperty.call(bonuses, key)) {
                bonuses[key] = toNumber(value);
            }
        });
    });

    return bonuses;
}

function buildApplyState(alliance, context) {
    const {
        player,
        playerHasAlliance,
        pendingApplicationIds = new Set()
    } = context;

    const hasPendingApplication = pendingApplicationIds.has(String(alliance.id));
    let canApply = true;
    let applyBlockedReason = null;

    if (playerHasAlliance) {
        canApply = false;
        applyBlockedReason = 'Ya perteneces a una alianza.';
    } else if (toNumber(alliance.membersCount) >= toNumber(alliance.maxMembers)) {
        canApply = false;
        applyBlockedReason = 'La alianza esta llena.';
    } else if (toNumber(player?.level) < toNumber(alliance.minLevelRequired)) {
        canApply = false;
        applyBlockedReason = 'No cumples el nivel minimo.';
    } else if (alliance.joinType === 'closed') {
        canApply = false;
        applyBlockedReason = 'La alianza esta cerrada.';
    } else if (hasPendingApplication) {
        canApply = false;
        applyBlockedReason = 'Ya tienes una solicitud pendiente.';
    }

    return { canApply, applyBlockedReason, hasPendingApplication };
}

async function getPlayer(playerId, client = pool, lock = false) {
    const result = await client.query(`
        SELECT id, username, level, gold, silver, copper, onix, bank_gold, bank_silver, bank_copper, last_login
        FROM players
        WHERE id = $1
        ${lock ? 'FOR UPDATE' : ''}
    `, [playerId]);

    if (result.rows.length === 0) throw httpError(404, 'Jugador no encontrado.');
    return result.rows[0];
}

async function getPendingApplicationIds(playerId, client = pool) {
    const result = await client.query(`
        SELECT alliance_id
        FROM alliance_applications
        WHERE player_id = $1
          AND status = 'pending'
    `, [playerId]);

    return new Set(result.rows.map((row) => String(row.alliance_id)));
}

async function listAlliances(playerId, query = {}) {
    const player = await getPlayer(playerId);
    const activeMembership = await getActiveMembership(playerId);
    const pendingApplicationIds = await getPendingApplicationIds(playerId);

    const page = clamp(toInt(query.page, 1), 1, 500);
    const limit = clamp(toInt(query.limit, 12), 1, 50);
    const search = normalizeNullableText(query.search, 80);
    const joinType = query.joinType ? normalizeJoinType(query.joinType) : null;
    const onlyAvailable = String(query.onlyAvailable || '').toLowerCase() === 'true';
    const onlyEligible = String(query.onlyEligible || '').toLowerCase() === 'true';
    const sortBy = String(query.sortBy || 'level').toLowerCase();

    const params = [];
    const conditions = ['a.is_active = true'];

    if (search) {
        params.push(`%${search}%`);
        conditions.push(`(a.name ILIKE $${params.length} OR a.tag ILIKE $${params.length} OR a.description ILIKE $${params.length})`);
    }

    if (joinType) {
        params.push(joinType);
        conditions.push(`a.join_type = $${params.length}`);
    }

    if (onlyAvailable) {
        conditions.push('a.members_count < a.max_members');
        conditions.push("a.join_type <> 'closed'");
    }

    const orderBy = {
        level: 'a.level DESC, a.members_count DESC, a.name ASC',
        members: 'a.members_count DESC, a.level DESC, a.name ASC',
        newest: 'a.created_at DESC',
        name: 'a.name ASC'
    }[sortBy] || 'a.level DESC, a.members_count DESC, a.name ASC';

    const result = await pool.query(`
        SELECT a.*, p.username AS leader_name
        FROM alliances a
        JOIN players p ON p.id = a.leader_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ${orderBy}
    `, params);

    const context = {
        player,
        playerHasAlliance: Boolean(activeMembership),
        pendingApplicationIds
    };

    let alliances = result.rows.map((row) => {
        const alliance = mapAlliance(row);
        return {
            ...alliance,
            ...buildApplyState(alliance, context)
        };
    });

    if (onlyEligible) {
        alliances = alliances.filter((alliance) => alliance.canApply);
    }

    const total = alliances.length;
    const offset = (page - 1) * limit;
    alliances = alliances.slice(offset, offset + limit);

    return {
        success: true,
        alliances,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
        },
        hasAlliance: Boolean(activeMembership)
    };
}

async function getMembers(allianceId, client = pool, { limit = null } = {}) {
    const params = [allianceId];
    const limitSql = limit ? `LIMIT ${clamp(toInt(limit, 10), 1, 100)}` : '';
    const result = await client.query(`
        SELECT
            am.id,
            am.alliance_id,
            am.player_id,
            am.role,
            am.title,
            am.donated_copper,
            am.donated_silver,
            am.donated_gold,
            am.donated_onix,
            am.joined_at,
            am.left_at,
            am.last_seen_at,
            p.username,
            p.level,
            p.last_login
        FROM alliance_members am
        JOIN players p ON p.id = am.player_id
        WHERE am.alliance_id = $1
          AND am.is_active = true
          AND am.left_at IS NULL
        ORDER BY
            CASE am.role WHEN 'leader' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
            p.level DESC,
            am.joined_at ASC
        ${limitSql}
    `, params);

    return result.rows.map((row) => ({
        memberId: String(row.id),
        playerId: row.player_id,
        username: row.username,
        level: toNumber(row.level),
        power: null,
        role: row.role,
        title: row.title,
        donated: {
            copper: toNumber(row.donated_copper),
            silver: toNumber(row.donated_silver),
            gold: toNumber(row.donated_gold),
            onix: toNumber(row.donated_onix)
        },
        joinedAt: row.joined_at,
        lastSeenAt: row.last_seen_at || row.last_login,
        isOnline: false
    }));
}

async function getRecentActivity(allianceId, client = pool, limit = 10) {
    const result = await client.query(`
        SELECT l.*, p.username AS actor_name
        FROM alliance_activity_logs l
        LEFT JOIN players p ON p.id = l.actor_player_id
        WHERE l.alliance_id = $1
        ORDER BY l.created_at DESC
        LIMIT $2
    `, [allianceId, limit]);

    return result.rows.map((row) => ({
        id: String(row.id),
        eventType: row.event_type,
        message: row.message,
        metadata: row.metadata || {},
        actorPlayerId: row.actor_player_id,
        actorName: row.actor_name,
        createdAt: row.created_at
    }));
}

async function getTopDonors(allianceId, client = pool, limit = 5) {
    const result = await client.query(`
        SELECT
            am.player_id,
            p.username,
            p.level,
            am.donated_copper,
            am.donated_silver,
            am.donated_gold,
            am.donated_onix
        FROM alliance_members am
        JOIN players p ON p.id = am.player_id
        WHERE am.alliance_id = $1
        ORDER BY
            (am.donated_gold * 10000 + am.donated_silver * 100 + am.donated_copper + am.donated_onix * 50000) DESC,
            p.level DESC
        LIMIT $2
    `, [allianceId, limit]);

    return result.rows.map((row) => ({
        playerId: row.player_id,
        username: row.username,
        level: toNumber(row.level),
        donated: {
            copper: toNumber(row.donated_copper),
            silver: toNumber(row.donated_silver),
            gold: toNumber(row.donated_gold),
            onix: toNumber(row.donated_onix)
        }
    }));
}

async function countPendingApplications(allianceId, client = pool) {
    const result = await client.query(`
        SELECT COUNT(*) AS total
        FROM alliance_applications
        WHERE alliance_id = $1
          AND status = 'pending'
    `, [allianceId]);

    return toNumber(result.rows[0]?.total);
}

async function getMyAlliance(playerId) {
    const membership = await getActiveMembership(playerId);
    if (!membership) {
        return { success: true, hasAlliance: false };
    }

    const allianceResult = await pool.query(`
        SELECT a.*, p.username AS leader_name
        FROM alliances a
        JOIN players p ON p.id = a.leader_id
        WHERE a.id = $1
          AND a.is_active = true
    `, [membership.alliance_id]);

    if (allianceResult.rows.length === 0) {
        return { success: true, hasAlliance: false };
    }

    const alliance = mapAlliance(allianceResult.rows[0]);
    const buildings = await getBuildings(membership.alliance_id);
    const membersPreview = await getMembers(membership.alliance_id, pool, { limit: 6 });
    const recentActivity = await getRecentActivity(membership.alliance_id);
    const pendingApplicationsCount = await countPendingApplications(membership.alliance_id);
    const topDonors = await getTopDonors(membership.alliance_id);
    const permissions = getAlliancePermissions(membership.role);

    return {
        success: true,
        hasAlliance: true,
        role: membership.role,
        permissions,
        alliance,
        buildings,
        membersPreview,
        treasury: alliance.treasury,
        bonuses: buildBonuses(buildings),
        recentActivity,
        pendingApplicationsCount,
        topDonors
    };
}

async function getPublicProfile(playerId, allianceId) {
    const player = await getPlayer(playerId);
    const activeMembership = await getActiveMembership(playerId);
    const pendingApplicationIds = await getPendingApplicationIds(playerId);

    const result = await pool.query(`
        SELECT a.*, p.username AS leader_name
        FROM alliances a
        JOIN players p ON p.id = a.leader_id
        WHERE a.id = $1
          AND a.is_active = true
    `, [allianceId]);

    if (result.rows.length === 0) throw httpError(404, 'Alianza no encontrada.');

    const alliance = mapAlliance(result.rows[0]);
    const buildings = await getBuildings(allianceId);
    const featuredMembers = await getMembers(allianceId, pool, { limit: 8 });

    return {
        success: true,
        alliance: {
            ...alliance,
            ...buildApplyState(alliance, {
                player,
                playerHasAlliance: Boolean(activeMembership),
                pendingApplicationIds
            })
        },
        bonuses: buildBonuses(buildings),
        featuredMembers
    };
}

async function insertActivity(client, allianceId, actorPlayerId, eventType, message, metadata = {}) {
    await client.query(`
        INSERT INTO alliance_activity_logs (alliance_id, actor_player_id, event_type, message, metadata)
        VALUES ($1, $2, $3, $4, $5)
    `, [allianceId, actorPlayerId || null, eventType, message, JSON.stringify(metadata || {})]);
}

async function createInitialBuildings(client, allianceId) {
    const definitions = await client.query(`
        SELECT id, code, unlock_requirements, is_future
        FROM alliance_building_definitions
        WHERE is_active = true
        ORDER BY sort_order ASC, id ASC
    `);

    for (const definition of definitions.rows) {
        const requirements = definition.unlock_requirements || {};
        const hasRequirements = Object.keys(requirements).length > 0;
        const isUnlocked = INITIAL_UNLOCKED_BUILDINGS.has(definition.code)
            || (!hasRequirements && !definition.is_future);

        await client.query(`
            INSERT INTO alliance_buildings (alliance_id, building_definition_id, level, is_unlocked)
            VALUES ($1, $2, 1, $3)
            ON CONFLICT (alliance_id, building_definition_id) DO NOTHING
        `, [allianceId, definition.id, isUnlocked]);
    }
}

async function createAlliance(playerId, payload = {}) {
    return withTransaction(async (client) => {
        const existingMembership = await getActiveMembership(playerId, client, true);
        if (existingMembership) throw httpError(400, 'Ya perteneces a una alianza activa.');

        const player = await getPlayer(playerId, client, true);
        if (toNumber(player.gold) < 1) {
            throw httpError(400, 'Crear una alianza cuesta 1 oro.');
        }

        const name = normalizeRequiredText(payload.name, 'El nombre', 60);
        const tag = normalizeTag(payload.tag);
        const description = normalizeRequiredText(payload.description, 'La descripcion', 1200);
        const messageOfTheDay = normalizeNullableText(payload.messageOfTheDay, 500) || '';
        const logoUrl = normalizeNullableText(payload.logoUrl, 255);
        const bannerUrl = normalizeNullableText(payload.bannerUrl, 255);
        const minLevelRequired = clamp(toInt(payload.minLevelRequired, 1), 1, 999);
        const minPowerRequired = clamp(toInt(payload.minPowerRequired, 0), 0, 999999999);
        const joinType = normalizeJoinType(payload.joinType, 'request');

        await client.query('UPDATE players SET gold = gold - 1 WHERE id = $1', [playerId]);

        let allianceResult;
        try {
            allianceResult = await client.query(`
                INSERT INTO alliances (
                    name,
                    tag,
                    description,
                    message_of_the_day,
                    logo_url,
                    banner_url,
                    leader_id,
                    level,
                    members_count,
                    max_members,
                    min_level_required,
                    min_power_required,
                    join_type,
                    treasury_copper_balance,
                    treasury_onix_balance,
                    total_donated_copper_value,
                    total_spent_copper_value
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 1, 3, $8, $9, $10, 0, 0, 0, 0)
                RETURNING *
            `, [
                name,
                tag,
                description,
                messageOfTheDay,
                logoUrl,
                bannerUrl,
                playerId,
                minLevelRequired,
                minPowerRequired,
                joinType
            ]);
        } catch (error) {
            if (error.code === '23505') {
                throw httpError(400, tag ? 'El nombre o tag ya esta en uso.' : 'El nombre ya esta en uso.');
            }
            throw error;
        }

        const alliance = allianceResult.rows[0];

        await client.query(`
            INSERT INTO alliance_members (alliance_id, player_id, role, title)
            VALUES ($1, $2, 'leader', 'Lider fundador')
        `, [alliance.id, playerId]);

        await createInitialBuildings(client, alliance.id);
        await insertActivity(
            client,
            alliance.id,
            playerId,
            'alliance.created',
            `${player.username} fundo la alianza ${alliance.name}.`,
            { name: alliance.name, tag: alliance.tag }
        );

        return {
            success: true,
            alliance: mapAlliance({ ...alliance, leader_name: player.username }),
            userCurrency: {
                gold: toNumber(player.gold) - 1,
                silver: toNumber(player.silver),
                copper: toNumber(player.copper),
                onix: toNumber(player.onix)
            }
        };
    });
}

async function applyToAlliance(playerId, allianceId, payload = {}) {
    return withTransaction(async (client) => {
        const existingMembership = await getActiveMembership(playerId, client, true);
        if (existingMembership) throw httpError(400, 'Ya perteneces a una alianza activa.');

        const player = await getPlayer(playerId, client);
        const allianceResult = await client.query(`
            SELECT a.*, p.username AS leader_name
            FROM alliances a
            JOIN players p ON p.id = a.leader_id
            WHERE a.id = $1
              AND a.is_active = true
            FOR UPDATE OF a
        `, [allianceId]);

        if (allianceResult.rows.length === 0) throw httpError(404, 'Alianza no encontrada.');
        const alliance = allianceResult.rows[0];

        if (alliance.join_type === 'closed') throw httpError(400, 'La alianza esta cerrada.');
        if (toNumber(alliance.members_count) >= toNumber(alliance.max_members)) throw httpError(400, 'La alianza esta llena.');
        if (toNumber(player.level) < toNumber(alliance.min_level_required)) throw httpError(400, 'No cumples el nivel minimo requerido.');

        const pendingResult = await client.query(`
            SELECT id
            FROM alliance_applications
            WHERE alliance_id = $1
              AND player_id = $2
              AND status = 'pending'
        `, [allianceId, playerId]);

        if (pendingResult.rows.length > 0) {
            throw httpError(400, 'Ya tienes una solicitud pendiente para esta alianza.');
        }

        if (alliance.join_type === 'open') {
            await client.query(`
                INSERT INTO alliance_members (alliance_id, player_id, role)
                VALUES ($1, $2, 'member')
            `, [allianceId, playerId]);

            await client.query(`
                UPDATE alliances
                SET members_count = members_count + 1,
                    updated_at = NOW()
                WHERE id = $1
            `, [allianceId]);

            await insertActivity(client, allianceId, playerId, 'member.joined', `${player.username} se unio a la alianza.`, {
                playerId
            });

            return {
                success: true,
                joined: true,
                message: 'Te uniste a la alianza.'
            };
        }

        let application;
        try {
            const applicationResult = await client.query(`
                INSERT INTO alliance_applications (alliance_id, player_id, message)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [allianceId, playerId, normalizeNullableText(payload.message, 500) || '']);
            application = applicationResult.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                throw httpError(400, 'Ya tienes una solicitud pendiente para esta alianza.');
            }
            throw error;
        }

        await insertActivity(client, allianceId, playerId, 'application.created', `${player.username} envio una solicitud de ingreso.`, {
            applicationId: application.id
        });

        return {
            success: true,
            joined: false,
            applicationId: String(application.id),
            message: 'Solicitud enviada.'
        };
    });
}

async function getApplications(playerId, allianceId) {
    const role = await getAllianceRole(playerId, allianceId);
    assertRole(role, [ROLES.leader, ROLES.admin]);

    const result = await pool.query(`
        SELECT
            aa.id,
            aa.player_id,
            aa.message,
            aa.created_at,
            p.username,
            p.level
        FROM alliance_applications aa
        JOIN players p ON p.id = aa.player_id
        WHERE aa.alliance_id = $1
          AND aa.status = 'pending'
        ORDER BY aa.created_at ASC
    `, [allianceId]);

    return {
        success: true,
        applications: result.rows.map((row) => ({
            applicationId: String(row.id),
            player: {
                id: row.player_id,
                username: row.username
            },
            level: toNumber(row.level),
            power: null,
            message: row.message,
            createdAt: row.created_at
        }))
    };
}

async function acceptApplication(playerId, applicationId) {
    return withTransaction(async (client) => {
        const applicationResult = await client.query(`
            SELECT aa.*, a.members_count, a.max_members, a.is_active
            FROM alliance_applications aa
            JOIN alliances a ON a.id = aa.alliance_id
            WHERE aa.id = $1
              AND aa.status = 'pending'
            FOR UPDATE OF aa, a
        `, [applicationId]);

        if (applicationResult.rows.length === 0) throw httpError(404, 'Solicitud no encontrada.');
        const application = applicationResult.rows[0];

        const role = await getAllianceRole(playerId, application.alliance_id, client);
        assertRole(role, [ROLES.leader, ROLES.admin]);

        if (!application.is_active) throw httpError(400, 'La alianza no esta activa.');
        if (toNumber(application.members_count) >= toNumber(application.max_members)) throw httpError(400, 'La alianza esta llena.');

        const applicantMembership = await getActiveMembership(application.player_id, client, true);
        if (applicantMembership) throw httpError(400, 'El jugador ya pertenece a una alianza.');

        const player = await getPlayer(application.player_id, client);

        await client.query(`
            UPDATE alliance_applications
            SET status = 'accepted',
                reviewed_by = $1,
                reviewed_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
        `, [playerId, applicationId]);

        await client.query(`
            INSERT INTO alliance_members (alliance_id, player_id, role)
            VALUES ($1, $2, 'member')
        `, [application.alliance_id, application.player_id]);

        await client.query(`
            UPDATE alliances
            SET members_count = members_count + 1,
                updated_at = NOW()
            WHERE id = $1
        `, [application.alliance_id]);

        await insertActivity(client, application.alliance_id, playerId, 'application.accepted', `Solicitud de ${player.username} aceptada.`, {
            applicationId
        });
        await insertActivity(client, application.alliance_id, application.player_id, 'member.joined', `${player.username} se unio a la alianza.`, {
            playerId: application.player_id
        });

        return { success: true, message: 'Solicitud aceptada.' };
    });
}

async function rejectApplication(playerId, applicationId) {
    return withTransaction(async (client) => {
        const applicationResult = await client.query(`
            SELECT aa.*, p.username
            FROM alliance_applications aa
            JOIN players p ON p.id = aa.player_id
            WHERE aa.id = $1
              AND aa.status = 'pending'
            FOR UPDATE OF aa
        `, [applicationId]);

        if (applicationResult.rows.length === 0) throw httpError(404, 'Solicitud no encontrada.');
        const application = applicationResult.rows[0];

        const role = await getAllianceRole(playerId, application.alliance_id, client);
        assertRole(role, [ROLES.leader, ROLES.admin]);

        await client.query(`
            UPDATE alliance_applications
            SET status = 'rejected',
                reviewed_by = $1,
                reviewed_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
        `, [playerId, applicationId]);

        await insertActivity(client, application.alliance_id, playerId, 'application.rejected', `Solicitud de ${application.username} rechazada.`, {
            applicationId
        });

        return { success: true, message: 'Solicitud rechazada.' };
    });
}

async function donate(playerId, payload = {}) {
    const money = normalizeMoney(payload);
    const copperValue = toCopperValue(money);

    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        const player = await getPlayer(playerId, client, true);

        if (toNumber(player.copper) < money.copper || toNumber(player.silver) < money.silver || toNumber(player.gold) < money.gold || toNumber(player.onix) < money.onix) {
            throw httpError(400, 'No tienes suficientes monedas para esa donacion.');
        }

        const allianceResult = await client.query(`
            SELECT *
            FROM alliances
            WHERE id = $1
              AND is_active = true
            FOR UPDATE
        `, [membership.alliance_id]);

        if (allianceResult.rows.length === 0) throw httpError(404, 'Alianza no encontrada.');

        await client.query(`
            UPDATE players
            SET copper = copper - $2,
                silver = silver - $3,
                gold = gold - $4,
                onix = onix - $5
            WHERE id = $1
        `, [playerId, money.copper, money.silver, money.gold, money.onix]);

        const updatedAlliance = await client.query(`
            UPDATE alliances
            SET treasury_copper_balance = COALESCE(treasury_copper_balance, 0) + $2,
                treasury_onix_balance = COALESCE(treasury_onix_balance, 0) + $3,
                total_donated_copper_value = COALESCE(total_donated_copper_value, 0) + $2,
                treasury_copper = treasury_copper + $4,
                treasury_silver = treasury_silver + $5,
                treasury_gold = treasury_gold + $6,
                treasury_onix = treasury_onix + $3,
                total_donated_copper = total_donated_copper + $4,
                total_donated_silver = total_donated_silver + $5,
                total_donated_gold = total_donated_gold + $6,
                total_donated_onix = total_donated_onix + $3,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [membership.alliance_id, copperValue, money.onix, money.copper, money.silver, money.gold]);

        await client.query(`
            UPDATE alliance_members
            SET donated_copper = donated_copper + $3,
                donated_silver = donated_silver + $4,
                donated_gold = donated_gold + $5,
                donated_onix = donated_onix + $6,
                last_seen_at = NOW()
            WHERE alliance_id = $1
              AND player_id = $2
              AND is_active = true
        `, [membership.alliance_id, playerId, money.copper, money.silver, money.gold, money.onix]);

        await client.query(`
            INSERT INTO alliance_donations (alliance_id, player_id, copper, silver, gold, onix)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [membership.alliance_id, playerId, money.copper, money.silver, money.gold, money.onix]);

        await insertActivity(client, membership.alliance_id, playerId, 'donation.created', `${player.username} dono recursos al tesoro.`, {
            ...money,
            copperValue
        });

        return {
            success: true,
            message: 'Donacion registrada.',
            userCurrency: {
                copper: toNumber(player.copper) - money.copper,
                silver: toNumber(player.silver) - money.silver,
                gold: toNumber(player.gold) - money.gold,
                onix: toNumber(player.onix) - money.onix
            },
            treasury: mapTreasury(updatedAlliance.rows[0])
        };
    });
}

async function getDonationInfo(playerId) {
    const membership = await requireActiveMembership(playerId);
    const allianceResult = await pool.query('SELECT * FROM alliances WHERE id = $1', [membership.alliance_id]);
    const player = await getPlayer(playerId);

    const recentResult = await pool.query(`
        SELECT d.*, p.username
        FROM alliance_donations d
        JOIN players p ON p.id = d.player_id
        WHERE d.alliance_id = $1
        ORDER BY d.created_at DESC
        LIMIT 15
    `, [membership.alliance_id]);

    return {
        success: true,
        treasure: mapTreasury(allianceResult.rows[0]),
        treasury: mapTreasury(allianceResult.rows[0]),
        myDonations: {
            copper: toNumber(membership.donated_copper),
            silver: toNumber(membership.donated_silver),
            gold: toNumber(membership.donated_gold),
            onix: toNumber(membership.donated_onix)
        },
        userCurrency: {
            copper: toNumber(player.copper),
            silver: toNumber(player.silver),
            gold: toNumber(player.gold),
            onix: toNumber(player.onix)
        },
        topDonors: await getTopDonors(membership.alliance_id),
        recentDonations: recentResult.rows.map((row) => ({
            id: String(row.id),
            playerId: row.player_id,
            username: row.username,
            copper: toNumber(row.copper),
            silver: toNumber(row.silver),
            gold: toNumber(row.gold),
            onix: toNumber(row.onix),
            note: row.note,
            createdAt: row.created_at
        }))
    };
}

function hasTreasuryFunds(alliance, cost = {}) {
    return toNumber(alliance.treasury_copper_balance) >= toNumber(cost.copperValue)
        && toNumber(alliance.treasury_onix_balance) >= toNumber(cost.onix);
}

async function unlockEligibleBuildings(client, allianceId) {
    const buildingsResult = await client.query(`
        SELECT b.id, b.level, b.is_unlocked, d.code, d.unlock_requirements
        FROM alliance_buildings b
        JOIN alliance_building_definitions d ON d.id = b.building_definition_id
        WHERE b.alliance_id = $1
          AND d.is_active = true
    `, [allianceId]);

    const levelsByCode = new Map(buildingsResult.rows.map((row) => [row.code, toNumber(row.level)]));

    for (const building of buildingsResult.rows) {
        if (building.is_unlocked) continue;
        const requirements = building.unlock_requirements || {};
        const requirementEntries = Object.entries(requirements);
        if (requirementEntries.length === 0) continue;

        const canUnlock = requirementEntries.every(([code, level]) => toNumber(levelsByCode.get(code)) >= toNumber(level));
        if (canUnlock) {
            await client.query(`
                UPDATE alliance_buildings
                SET is_unlocked = true,
                    updated_at = NOW()
                WHERE id = $1
            `, [building.id]);
        }
    }
}

async function upgradeBuilding(playerId, buildingId) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        assertRole(membership.role, [ROLES.leader, ROLES.admin]);

        const result = await client.query(`
            SELECT
                b.*,
                d.code,
                d.name,
                d.max_level,
                d.level_effects,
                d.upgrade_costs,
                a.treasury_copper_balance,
                a.treasury_onix_balance
            FROM alliance_buildings b
            JOIN alliance_building_definitions d ON d.id = b.building_definition_id
            JOIN alliances a ON a.id = b.alliance_id
            WHERE b.id = $1
              AND b.alliance_id = $2
              AND a.is_active = true
            FOR UPDATE OF b, a
        `, [buildingId, membership.alliance_id]);

        if (result.rows.length === 0) throw httpError(404, 'Edificio no encontrado.');
        const building = result.rows[0];

        if (!building.is_unlocked) throw httpError(400, 'El edificio esta bloqueado.');
        if (toNumber(building.level) >= toNumber(building.max_level)) throw httpError(400, 'El edificio ya esta al nivel maximo.');

        const nextLevel = toNumber(building.level) + 1;
        const cost = normalizeUpgradeCost(stripLevel(getCostForLevel(building.upgrade_costs, nextLevel) || {}));
        if (!cost || Object.keys(cost).length === 0) throw httpError(400, 'No hay costo de mejora configurado.');
        if (!hasTreasuryFunds(building, cost)) throw httpError(400, 'El tesoro no tiene fondos suficientes.');

        await client.query(`
            UPDATE alliances
            SET treasury_copper_balance = COALESCE(treasury_copper_balance, 0) - $2,
                treasury_onix_balance = COALESCE(treasury_onix_balance, 0) - $3,
                total_spent_copper_value = COALESCE(total_spent_copper_value, 0) + $2,
                updated_at = NOW()
            WHERE id = $1
        `, [
            membership.alliance_id,
            toNumber(cost.copperValue),
            toNumber(cost.onix)
        ]);

        await client.query(`
            UPDATE alliance_buildings
            SET level = level + 1,
                updated_at = NOW()
            WHERE id = $1
        `, [buildingId]);

        if (building.code === 'great_hall') {
            const nextEffect = getEffectForLevel(building.level_effects, nextLevel);
            if (nextEffect.maxMembers) {
                await client.query(`
                    UPDATE alliances
                    SET max_members = $2,
                        updated_at = NOW()
                    WHERE id = $1
                `, [membership.alliance_id, toNumber(nextEffect.maxMembers)]);
            }
        }

        await unlockEligibleBuildings(client, membership.alliance_id);
        await insertActivity(client, membership.alliance_id, playerId, 'building.upgraded', `Se mejoro ${building.name} al nivel ${nextLevel}.`, {
            buildingId,
            code: building.code,
            level: nextLevel,
            cost
        });

        const allianceResult = await client.query(`
            SELECT a.*, p.username AS leader_name
            FROM alliances a
            JOIN players p ON p.id = a.leader_id
            WHERE a.id = $1
        `, [membership.alliance_id]);

        return {
            success: true,
            message: 'Edificio mejorado.',
            buildings: await getBuildings(membership.alliance_id, client),
            alliance: mapAlliance(allianceResult.rows[0])
        };
    });
}

async function getMyMembers(playerId) {
    const membership = await requireActiveMembership(playerId);
    return {
        success: true,
        members: await getMembers(membership.alliance_id)
    };
}

async function findMemberInAlliance(client, allianceId, memberId, lock = true) {
    const result = await client.query(`
        SELECT am.*, p.username, p.level
        FROM alliance_members am
        JOIN players p ON p.id = am.player_id
        WHERE am.alliance_id = $1
          AND (am.id::text = $2 OR am.player_id::text = $2)
          AND am.is_active = true
          AND am.left_at IS NULL
        ${lock ? 'FOR UPDATE OF am' : ''}
    `, [allianceId, String(memberId)]);

    if (result.rows.length === 0) throw httpError(404, 'Miembro no encontrado.');
    return result.rows[0];
}

async function promoteMember(playerId, memberId) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        assertRole(membership.role, [ROLES.leader]);

        const target = await findMemberInAlliance(client, membership.alliance_id, memberId);
        if (target.role !== ROLES.member) throw httpError(400, 'Solo puedes promover miembros normales.');

        await client.query("UPDATE alliance_members SET role = 'admin' WHERE id = $1", [target.id]);
        await insertActivity(client, membership.alliance_id, playerId, 'member.promoted', `${target.username} fue ascendido a administrador.`, {
            targetPlayerId: target.player_id
        });

        return { success: true, message: 'Miembro promovido.' };
    });
}

async function demoteMember(playerId, memberId) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        assertRole(membership.role, [ROLES.leader]);

        const target = await findMemberInAlliance(client, membership.alliance_id, memberId);
        if (target.role !== ROLES.admin) throw httpError(400, 'Solo puedes degradar administradores.');

        await client.query("UPDATE alliance_members SET role = 'member' WHERE id = $1", [target.id]);
        await insertActivity(client, membership.alliance_id, playerId, 'member.demoted', `${target.username} fue degradado a miembro.`, {
            targetPlayerId: target.player_id
        });

        return { success: true, message: 'Miembro degradado.' };
    });
}

async function kickMember() {
    throw httpError(400, 'Las expulsiones deben resolverse en el Salon del Juicio.');
}

async function leaveAlliance(playerId) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        const allianceResult = await client.query(`
            SELECT *
            FROM alliances
            WHERE id = $1
              AND is_active = true
            FOR UPDATE
        `, [membership.alliance_id]);

        if (allianceResult.rows.length === 0) throw httpError(404, 'Alianza no encontrada.');
        const alliance = allianceResult.rows[0];

        if (membership.role === ROLES.leader && toNumber(alliance.members_count) > 1) {
            throw httpError(400, 'El lider debe transferir liderazgo o disolver la alianza antes de salir.');
        }

        await client.query(`
            UPDATE alliance_members
            SET is_active = false,
                left_at = NOW()
            WHERE id = $1
        `, [membership.id]);

        const shouldDeactivateAlliance = membership.role === ROLES.leader;
        await client.query(`
            UPDATE alliances
            SET members_count = GREATEST(members_count - 1, 0),
                is_active = CASE WHEN $2 THEN false ELSE is_active END,
                updated_at = NOW()
            WHERE id = $1
        `, [membership.alliance_id, shouldDeactivateAlliance]);

        await insertActivity(client, membership.alliance_id, playerId, 'member.left', 'Un miembro abandono la alianza.', {
            playerId
        });

        return { success: true, message: 'Has salido de la alianza.' };
    });
}

async function updateSettings(playerId, payload = {}) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        assertRole(membership.role, [ROLES.leader, ROLES.admin]);

        const leaderFields = {
            description: ['description', normalizeNullableText(payload.description, 1200)],
            messageOfTheDay: ['message_of_the_day', normalizeNullableText(payload.messageOfTheDay, 500)],
            logoUrl: ['logo_url', normalizeNullableText(payload.logoUrl, 255)],
            bannerUrl: ['banner_url', normalizeNullableText(payload.bannerUrl, 255)],
            minLevelRequired: ['min_level_required', payload.minLevelRequired === undefined ? null : clamp(toInt(payload.minLevelRequired, 1), 1, 999)],
            minPowerRequired: ['min_power_required', payload.minPowerRequired === undefined ? null : clamp(toInt(payload.minPowerRequired, 0), 0, 999999999)],
            joinType: ['join_type', payload.joinType === undefined ? null : normalizeJoinType(payload.joinType)]
        };

        const adminAllowed = new Set(['description', 'messageOfTheDay']);
        const updates = [];

        Object.entries(leaderFields).forEach(([payloadKey, [column, value]]) => {
            if (value === null || value === undefined) return;
            if (membership.role === ROLES.admin && !adminAllowed.has(payloadKey)) {
                throw httpError(403, 'Un administrador solo puede editar descripcion y mensaje del dia.');
            }
            updates.push([column, value]);
        });

        if (updates.length === 0) throw httpError(400, 'No hay cambios para guardar.');

        const setSql = updates.map(([column], index) => `${column} = $${index + 2}`).join(', ');
        const values = updates.map(([, value]) => value);
        const result = await client.query(`
            UPDATE alliances
            SET ${setSql},
                updated_at = NOW()
            WHERE id = $1
              AND is_active = true
            RETURNING *
        `, [membership.alliance_id, ...values]);

        await insertActivity(client, membership.alliance_id, playerId, 'alliance.updated', 'La configuracion de la alianza fue actualizada.', {
            fields: updates.map(([column]) => column)
        });

        return {
            success: true,
            message: 'Configuracion actualizada.',
            alliance: mapAlliance(result.rows[0])
        };
    });
}

async function transferLeadership(playerId, newLeaderPlayerId) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        assertRole(membership.role, [ROLES.leader]);

        if (!newLeaderPlayerId || newLeaderPlayerId === playerId) {
            throw httpError(400, 'Selecciona otro miembro activo como lider.');
        }

        const target = await findMemberInAlliance(client, membership.alliance_id, newLeaderPlayerId);

        await client.query(`
            UPDATE alliance_members
            SET role = CASE
                WHEN player_id = $2 THEN 'admin'
                WHEN player_id = $3 THEN 'leader'
                ELSE role
            END
            WHERE alliance_id = $1
              AND player_id IN ($2, $3)
        `, [membership.alliance_id, playerId, newLeaderPlayerId]);

        await client.query(`
            UPDATE alliances
            SET leader_id = $2,
                updated_at = NOW()
            WHERE id = $1
        `, [membership.alliance_id, newLeaderPlayerId]);

        await insertActivity(client, membership.alliance_id, playerId, 'alliance.leadership_transferred', `El liderazgo fue transferido a ${target.username}.`, {
            newLeaderPlayerId
        });

        return { success: true, message: 'Liderazgo transferido.' };
    });
}

async function disbandAlliance(playerId) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        assertRole(membership.role, [ROLES.leader]);

        await client.query(`
            UPDATE alliances
            SET is_active = false,
                updated_at = NOW()
            WHERE id = $1
              AND is_active = true
        `, [membership.alliance_id]);

        await client.query(`
            UPDATE alliance_members
            SET is_active = false,
                left_at = NOW()
            WHERE alliance_id = $1
              AND is_active = true
        `, [membership.alliance_id]);

        await insertActivity(client, membership.alliance_id, playerId, 'alliance.disbanded', 'La alianza fue disuelta.', {
            allianceId: membership.alliance_id
        });

        return { success: true, message: 'Alianza disuelta.' };
    });
}

async function countActiveMembers(allianceId, client = pool) {
    const result = await client.query(`
        SELECT COUNT(*) AS total
        FROM alliance_members
        WHERE alliance_id = $1
          AND is_active = true
          AND left_at IS NULL
    `, [allianceId]);

    return toNumber(result.rows[0]?.total);
}

function mapJudgement(row, membership, myVote = null, activeMembersCount = 0) {
    if (!row) return null;
    const now = Date.now();
    const endsAtMs = row.ends_at ? new Date(row.ends_at).getTime() : now;
    const isActive = row.status === 'active';
    const isExpired = isActive && endsAtMs <= now;
    const isAccused = String(row.accused_player_id) === String(membership.player_id);
    let cannotVoteReason = null;

    if (!isActive) cannotVoteReason = 'El juicio ya fue resuelto.';
    else if (isExpired) cannotVoteReason = 'El tiempo de votacion termino.';
    else if (isAccused) cannotVoteReason = 'Estas siendo juzgado. No puedes votar en tu propio juicio.';
    else if (myVote) cannotVoteReason = `Tu voto fue registrado: ${myVote === 'expel' ? 'Expulsar' : 'Mantener'}.`;

    return {
        id: String(row.id),
        accusedPlayer: {
            id: row.accused_player_id,
            username: row.accused_username,
            level: toNumber(row.accused_level),
            role: row.accused_role,
            joinedAt: row.accused_joined_at,
            classPath: row.accused_class_path,
            avatarUrl: row.accused_class_image || '/icons/sidebar/hero_overview.png'
        },
        proposedBy: {
            id: row.proposed_by,
            username: row.proposed_by_username
        },
        reason: row.reason,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        resolvedAt: row.resolved_at,
        status: row.status,
        votesExpel: toNumber(row.votes_expel),
        votesKeep: toNumber(row.votes_keep),
        resolutionNote: row.resolution_note,
        myVote,
        canVote: Boolean(isActive && !isExpired && !isAccused && !myVote),
        cannotVoteReason,
        canResolve: Boolean(isActive && isExpired),
        remainingSeconds: Math.max(0, Math.ceil((endsAtMs - now) / 1000)),
        activeMembersCount
    };
}

async function getJudgementRow(client, judgementId, playerId) {
    const result = await client.query(`
        SELECT
            j.*,
            accused.username AS accused_username,
            accused.level AS accused_level,
            accused.class_path AS accused_class_path,
            accused_class.image_url AS accused_class_image,
            accused_member.role AS accused_role,
            accused_member.joined_at AS accused_joined_at,
            proposer.username AS proposed_by_username,
            v.vote AS my_vote
        FROM alliance_judgements j
        JOIN players accused ON accused.id = j.accused_player_id
        JOIN alliance_members accused_member
          ON accused_member.alliance_id = j.alliance_id
         AND accused_member.player_id = j.accused_player_id
        JOIN players proposer ON proposer.id = j.proposed_by
        LEFT JOIN classes accused_class ON accused_class.id = accused.class_id
        LEFT JOIN alliance_judgement_votes v
          ON v.judgement_id = j.id
         AND v.voter_player_id = $2
        WHERE j.id = $1
        LIMIT 1
    `, [judgementId, playerId]);

    return result.rows[0] || null;
}

async function resolveJudgementRow(client, judgement, actorPlayerId = null) {
    if (!judgement || judgement.status !== 'active') return judgement;
    const accusedResult = await client.query('SELECT username FROM players WHERE id = $1', [judgement.accused_player_id]);
    const accusedName = accusedResult.rows[0]?.username || 'El acusado';
    const shouldExpel = toNumber(judgement.votes_expel) > toNumber(judgement.votes_keep);

    if (shouldExpel) {
        await client.query(`
            UPDATE alliance_members
            SET is_active = false,
                left_at = NOW()
            WHERE alliance_id = $1
              AND player_id = $2
              AND is_active = true
              AND left_at IS NULL
        `, [judgement.alliance_id, judgement.accused_player_id]);

        await client.query(`
            UPDATE alliances
            SET members_count = GREATEST(members_count - 1, 0),
                updated_at = NOW()
            WHERE id = $1
        `, [judgement.alliance_id]);

        const updated = await client.query(`
            UPDATE alliance_judgements
            SET status = 'expelled',
                resolved_at = NOW(),
                resolution_note = 'Expulsado por votacion del Salon del Juicio.',
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [judgement.id]);

        await insertActivity(client, judgement.alliance_id, actorPlayerId, 'judgement.resolved_expelled', `${accusedName} fue expulsado por decision de la alianza.`, {
            judgementId: judgement.id,
            accusedPlayerId: judgement.accused_player_id
        });

        return updated.rows[0];
    }

    const updated = await client.query(`
        UPDATE alliance_judgements
        SET status = 'kept',
            resolved_at = NOW(),
            resolution_note = 'La alianza decidio conservar al miembro.',
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `, [judgement.id]);

    await insertActivity(client, judgement.alliance_id, actorPlayerId, 'judgement.resolved_kept', `${accusedName} permanecio en la alianza por decision de la alianza.`, {
        judgementId: judgement.id,
        accusedPlayerId: judgement.accused_player_id
    });

    return updated.rows[0];
}

async function resolveExpiredJudgements(client, allianceId) {
    const result = await client.query(`
        SELECT *
        FROM alliance_judgements
        WHERE alliance_id = $1
          AND status = 'active'
          AND ends_at <= NOW()
        FOR UPDATE
    `, [allianceId]);

    for (const judgement of result.rows) {
        await resolveJudgementRow(client, judgement);
    }
}

async function getJudgements(playerId) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        await resolveExpiredJudgements(client, membership.alliance_id);

        const activeMembersCount = await countActiveMembers(membership.alliance_id, client);
        const activeResult = await client.query(`
            SELECT id
            FROM alliance_judgements
            WHERE alliance_id = $1
              AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
        `, [membership.alliance_id]);

        const activeRow = activeResult.rows[0]
            ? await getJudgementRow(client, activeResult.rows[0].id, playerId)
            : null;

        const historyResult = await client.query(`
            SELECT id
            FROM alliance_judgements
            WHERE alliance_id = $1
              AND status <> 'active'
            ORDER BY COALESCE(resolved_at, created_at) DESC
            LIMIT 12
        `, [membership.alliance_id]);

        const history = [];
        for (const row of historyResult.rows) {
            const judgementRow = await getJudgementRow(client, row.id, playerId);
            history.push(mapJudgement(judgementRow, membership, judgementRow?.my_vote || null, activeMembersCount));
        }

        return {
            success: true,
            activeJudgement: activeRow ? mapJudgement(activeRow, membership, activeRow.my_vote, activeMembersCount) : null,
            history,
            canStartJudgement: [ROLES.leader, ROLES.admin].includes(membership.role) && !activeRow,
            activeMembersCount
        };
    });
}

async function getEligibleJudgementMembers(playerId) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        assertRole(membership.role, [ROLES.leader, ROLES.admin]);
        await resolveExpiredJudgements(client, membership.alliance_id);

        const result = await client.query(`
            SELECT
                am.player_id,
                am.role,
                am.joined_at,
                am.last_seen_at,
                p.username,
                p.level
            FROM alliance_members am
            JOIN players p ON p.id = am.player_id
            WHERE am.alliance_id = $1
              AND am.is_active = true
              AND am.left_at IS NULL
              AND am.player_id <> $2
              AND am.role <> 'leader'
              AND NOT EXISTS (
                  SELECT 1
                  FROM alliance_judgements j
                  WHERE j.alliance_id = am.alliance_id
                    AND j.accused_player_id = am.player_id
                    AND j.status = 'active'
              )
            ORDER BY
                CASE am.role WHEN 'admin' THEN 1 ELSE 2 END,
                p.level DESC,
                p.username ASC
        `, [membership.alliance_id, playerId]);

        return {
            success: true,
            members: result.rows.map((row) => ({
                playerId: row.player_id,
                username: row.username,
                level: toNumber(row.level),
                role: row.role,
                joinedAt: row.joined_at,
                lastSeenAt: row.last_seen_at
            }))
        };
    });
}

async function startJudgement(playerId, payload = {}) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        assertRole(membership.role, [ROLES.leader, ROLES.admin]);
        await resolveExpiredJudgements(client, membership.alliance_id);

        const accusedPlayerId = payload.accusedPlayerId;
        const reason = normalizeRequiredText(payload.reason, 'El motivo', 600);
        if (!accusedPlayerId) throw httpError(400, 'Selecciona un miembro.');
        if (String(accusedPlayerId) === String(playerId)) throw httpError(400, 'No puedes iniciar juicio contra ti mismo.');

        const activeAllianceJudgement = await client.query(`
            SELECT id
            FROM alliance_judgements
            WHERE alliance_id = $1
              AND status = 'active'
            LIMIT 1
        `, [membership.alliance_id]);
        if (activeAllianceJudgement.rows.length > 0) throw httpError(400, 'Ya existe un juicio activo en la alianza.');

        const target = await findMemberInAlliance(client, membership.alliance_id, accusedPlayerId);
        if (target.role === ROLES.leader) throw httpError(400, 'No se puede juzgar al lider en esta version.');

        const activeTargetJudgement = await client.query(`
            SELECT id
            FROM alliance_judgements
            WHERE alliance_id = $1
              AND accused_player_id = $2
              AND status = 'active'
            LIMIT 1
        `, [membership.alliance_id, accusedPlayerId]);
        if (activeTargetJudgement.rows.length > 0) throw httpError(400, 'Ese miembro ya tiene un juicio activo.');

        const activeMembersCount = await countActiveMembers(membership.alliance_id, client);
        const eligibleVotersCount = Math.max(0, activeMembersCount - 1);

        const result = await client.query(`
            INSERT INTO alliance_judgements (
                alliance_id,
                proposed_by,
                accused_player_id,
                reason,
                status,
                starts_at,
                ends_at,
                eligible_voters_count
            )
            VALUES ($1, $2, $3, $4, 'active', NOW(), NOW() + INTERVAL '1 hour', $5)
            RETURNING *
        `, [membership.alliance_id, playerId, accusedPlayerId, reason, eligibleVotersCount]);

        await insertActivity(client, membership.alliance_id, playerId, 'judgement.created', `Se proclamo juicio contra ${target.username}.`, {
            judgementId: result.rows[0].id,
            accusedPlayerId
        });

        const judgementRow = await getJudgementRow(client, result.rows[0].id, playerId);

        return {
            success: true,
            message: 'Juicio proclamado.',
            judgement: mapJudgement(judgementRow, membership, judgementRow.my_vote, activeMembersCount)
        };
    });
}

async function voteJudgement(playerId, judgementId, payload = {}) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        const vote = String(payload.vote || '').toLowerCase();
        if (!['expel', 'keep'].includes(vote)) throw httpError(400, 'Voto invalido.');

        const result = await client.query(`
            SELECT *
            FROM alliance_judgements
            WHERE id = $1
            FOR UPDATE
        `, [judgementId]);

        if (result.rows.length === 0) throw httpError(404, 'Juicio no encontrado.');
        const judgement = result.rows[0];
        if (String(judgement.alliance_id) !== String(membership.alliance_id)) throw httpError(403, 'El juicio no pertenece a tu alianza.');
        if (judgement.status !== 'active') throw httpError(400, 'El juicio ya fue resuelto.');
        if (new Date(judgement.ends_at).getTime() <= Date.now()) throw httpError(400, 'El juicio ya vencio.');
        if (String(judgement.accused_player_id) === String(playerId)) throw httpError(403, 'No puedes votar en tu propio juicio.');

        const existingVote = await client.query(`
            SELECT id
            FROM alliance_judgement_votes
            WHERE judgement_id = $1
              AND voter_player_id = $2
            LIMIT 1
        `, [judgementId, playerId]);
        if (existingVote.rows.length > 0) throw httpError(400, 'Ya emitiste tu voto en este juicio.');

        await client.query(`
            INSERT INTO alliance_judgement_votes (judgement_id, voter_player_id, vote)
            VALUES ($1, $2, $3)
        `, [judgementId, playerId, vote]);

        await client.query(`
            UPDATE alliance_judgements
            SET votes_expel = votes_expel + CASE WHEN $2 = 'expel' THEN 1 ELSE 0 END,
                votes_keep = votes_keep + CASE WHEN $2 = 'keep' THEN 1 ELSE 0 END,
                updated_at = NOW()
            WHERE id = $1
        `, [judgementId, vote]);

        const voter = await getPlayer(playerId, client);
        await insertActivity(client, membership.alliance_id, playerId, 'judgement.vote', `${voter.username} emitio su voto en el Salon del Juicio.`, {
            judgementId,
            vote
        });

        let message = 'Voto registrado.';
        const voteCountResult = await client.query(`
            SELECT COUNT(*) AS total
            FROM alliance_judgement_votes
            WHERE judgement_id = $1
        `, [judgementId]);
        const totalVotes = toNumber(voteCountResult.rows[0]?.total);
        const eligibleVotersCount = toNumber(judgement.eligible_voters_count);

        if (eligibleVotersCount > 0 && totalVotes >= eligibleVotersCount) {
            const updatedJudgementResult = await client.query(`
                SELECT *
                FROM alliance_judgements
                WHERE id = $1
            `, [judgementId]);
            await resolveJudgementRow(client, updatedJudgementResult.rows[0], playerId);
            message = 'Voto registrado. Todos los votantes emitieron su voto. El juicio ha sido resuelto.';
        }

        const activeMembersCount = await countActiveMembers(membership.alliance_id, client);
        const judgementRow = await getJudgementRow(client, judgementId, playerId);

        return {
            success: true,
            message,
            judgement: mapJudgement(judgementRow, membership, judgementRow.my_vote, activeMembersCount)
        };
    });
}

async function resolveJudgement(playerId, judgementId) {
    return withTransaction(async (client) => {
        const membership = await requireActiveMembership(playerId, client);
        const result = await client.query(`
            SELECT *
            FROM alliance_judgements
            WHERE id = $1
            FOR UPDATE
        `, [judgementId]);

        if (result.rows.length === 0) throw httpError(404, 'Juicio no encontrado.');
        let judgement = result.rows[0];
        if (String(judgement.alliance_id) !== String(membership.alliance_id)) throw httpError(403, 'El juicio no pertenece a tu alianza.');

        if (judgement.status === 'active') {
            if (new Date(judgement.ends_at).getTime() > Date.now()) {
                const activeMembersCount = await countActiveMembers(membership.alliance_id, client);
                const activeRow = await getJudgementRow(client, judgementId, playerId);
                return {
                    success: true,
                    message: 'El juicio sigue en votacion.',
                    judgement: mapJudgement(activeRow, membership, activeRow.my_vote, activeMembersCount)
                };
            }
            judgement = await resolveJudgementRow(client, judgement, playerId);
        }

        const activeMembersCount = await countActiveMembers(membership.alliance_id, client);
        const judgementRow = await getJudgementRow(client, judgement.id, playerId);

        return {
            success: true,
            message: 'Juicio resuelto.',
            judgement: mapJudgement(judgementRow, membership, judgementRow.my_vote, activeMembersCount)
        };
    });
}

module.exports = {
    getAllianceRole,
    getAlliancePermissions,
    listAlliances,
    getMyAlliance,
    getPublicProfile,
    createAlliance,
    applyToAlliance,
    getApplications,
    acceptApplication,
    rejectApplication,
    donate,
    getDonationInfo,
    upgradeBuilding,
    getMyMembers,
    promoteMember,
    demoteMember,
    kickMember,
    leaveAlliance,
    updateSettings,
    transferLeadership,
    disbandAlliance,
    getJudgements,
    getEligibleJudgementMembers,
    startJudgement,
    voteJudgement,
    resolveJudgement
};
