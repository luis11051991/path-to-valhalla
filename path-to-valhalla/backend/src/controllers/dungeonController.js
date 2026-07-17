const pool = require('../config/db');
const crypto = require('crypto');
const { hydratePlayer, computeMaxHp } = require('../shared/player_stats');
const { simulateStageCombat, generateEnemyForStage, computeNpcStats, DIFFICULTY_MULTIPLIERS } = require('../shared/dungeon_combat');
const { computeStageRewards, createGreedRoll, isGreedItem } = require('../shared/dungeon_loot');
const { normalizeCurrency } = require('../utils/currencyUtils');

const PARTY_ROOM_MAP = { 3: 4, 4: 6, 5: 8 };
const ROOM_EXPIRY_MINUTES = 30;
const DAILY_RUN_LIMIT = 3;
const ENTRY_PRICE_ONIX = 50;

const assertInteger = (value, fieldName) => {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
        throw new Error(`${fieldName} inválido: ${value}`);
    }
    return n;
};

const stripSensitiveFields = (room) => {
    if (!room) return room;
    const { access_password, ...safe } = room;
    return safe;
};

const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[crypto.randomInt(0, chars.length)];
    }
    return code;
};

const parseJsonValue = (value, fallback) => {
    if (value == null) return fallback;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }
    return value;
};

const selectCurrentStage = (run, stages) => {
    if (!run || !Array.isArray(stages) || stages.length === 0) return null;
    const currentRoom = assertInteger(run.current_room_number, 'current_room_number');
    return stages.find((stage) => stage.room_number === currentRoom)
        || stages.find((stage) => stage.status === 'in_progress')
        || stages.find((stage) => stage.status === 'pending')
        || stages[stages.length - 1];
};

const buildStagePayload = (stage, run) => {
    if (!stage || !run) return null;
    const isBoss = stage.room_number === run.total_rooms;
    return {
        id: stage.id,
        room_number: stage.room_number,
        stage_number: stage.room_number,
        stage_index: stage.stage_number,
        stage_type: isBoss ? 'boss' : 'combat',
        status: stage.status,
        is_boss: isBoss,
        name: isBoss ? 'Jefe final' : `Sala ${stage.room_number}`,
        display_name: isBoss ? 'Jefe final' : `Sala ${stage.room_number}`,
        created_at: stage.created_at,
        completed_at: stage.completed_at
    };
};

const normalizeRunHp = (currentHp, maxHp) => {
    const safeMaxHp = Math.max(1, Number(maxHp) || 1);
    const safeCurrentHp = Number(currentHp);
    if (!Number.isFinite(safeCurrentHp)) {
        return safeMaxHp;
    }
    return Math.max(0, Math.min(Math.floor(safeCurrentHp), safeMaxHp));
};

const syncRunMemberHpToPlayers = async (client, runId) => {
    const runMembers = (await client.query(`
        SELECT drm.player_id, drm.final_hp
        FROM dungeon_run_members drm
        WHERE drm.run_id = $1
          AND drm.player_id IS NOT NULL
          AND drm.is_npc = false
    `, [runId])).rows;

    for (const member of runMembers) {
        const playerStats = await hydratePlayer(member.player_id, client);
        const maxHp = playerStats.calculatedMaxHp || computeMaxHp((playerStats.total_stats?.constitution || 0));
        const persistedHp = Number(member.final_hp) <= 0
            ? 1
            : normalizeRunHp(member.final_hp, maxHp);

        await client.query(
            'UPDATE players SET current_hp = $1 WHERE id = $2',
            [persistedHp, member.player_id]
        );
    }
};

const ensureStageEnemies = async (client, run, stage) => {
    if (!run || !stage || !['pending', 'in_progress'].includes(stage.status)) {
        return [];
    }

    const existingEnemies = await client.query(
        'SELECT * FROM dungeon_stage_enemies WHERE stage_id = $1 ORDER BY id ASC',
        [stage.id]
    );
    if (existingEnemies.rows.length > 0) {
        return existingEnemies.rows;
    }

    const typeRes = await client.query('SELECT zone_id, min_level FROM dungeon_types WHERE id = $1', [run.dungeon_type_id]);
    const zoneId = typeRes.rows[0]?.zone_id;
    const dungeonLevel = Number(typeRes.rows[0]?.min_level) || 1;
    const templateRes = await client.query(`
        SELECT *
        FROM enemies
        WHERE zone_id = $1
          AND COALESCE(spawn_context, 'expedition') IN ('dungeon', 'all')
          AND COALESCE(is_hidden, false) = false
          AND COALESCE(min_level, 1) <= $2
          AND COALESCE(max_level, 9999) >= $2
        ORDER BY is_boss DESC, difficulty_tier ASC, id ASC
    `, [zoneId, dungeonLevel]);
    const enemyTemplates = templateRes.rows;
    const isBossRoom = run.current_room_number === run.total_rooms;

    let filteredEnemies = enemyTemplates.filter((enemy) => {
        const tier = Number(enemy.difficulty_tier) || 1;
        if (isBossRoom) return !!enemy.is_boss || tier === 3;
        return !enemy.is_boss && tier <= 2;
    });
    if (isBossRoom) {
        const bossTemplates = enemyTemplates.filter((enemy) => enemy.is_boss || Number(enemy.difficulty_tier) === 3);
        filteredEnemies = bossTemplates.length > 0 ? bossTemplates.concat(enemyTemplates.filter((enemy) => !enemy.is_boss)) : filteredEnemies;
    }
    if (filteredEnemies.length === 0 && enemyTemplates.length > 0) {
        filteredEnemies = [enemyTemplates[0]];
    }
    if (filteredEnemies.length === 0) {
        throw new Error('No hay enemigos configurados para esta zona.');
    }

    const runMembersRes = await client.query('SELECT id FROM dungeon_run_members WHERE run_id = $1', [run.id]);
    const enemyCount = Math.min(runMembersRes.rows.length + 1, isBossRoom ? 2 : 4);
    const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[run.difficulty] || 1.0;

    for (let index = 0; index < enemyCount; index++) {
        const template = filteredEnemies[index % filteredEnemies.length];
        const seed = `${run.id}-${stage.id}-${index}`;
        const generated = generateEnemyForStage(template, seed, difficultyMultiplier);
        const isBoss = isBossRoom && (index === 0 || generated.is_boss);

        await client.query(`
            INSERT INTO dungeon_stage_enemies (
                stage_id, enemy_template_id, name, level, hp_max, hp_current,
                damage_min, damage_max, armor, crit_chance, block_chance,
                is_boss, is_elite, image_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
            stage.id,
            generated.enemy_template_id,
            generated.name || 'Enemigo',
            assertInteger(generated.level, 'enemy.level'),
            assertInteger(generated.hp_max, 'enemy.hp_max'),
            assertInteger(generated.hp_current, 'enemy.hp_current'),
            assertInteger(generated.damage_min, 'enemy.damage_min'),
            assertInteger(generated.damage_max, 'enemy.damage_max'),
            assertInteger(generated.armor, 'enemy.armor'),
            generated.crit_chance || 0,
            generated.block_chance || 0,
            !!isBoss,
            !!generated.is_elite,
            generated.image_url || null
        ]);
    }

    const createdEnemies = await client.query(
        'SELECT * FROM dungeon_stage_enemies WHERE stage_id = $1 ORDER BY id ASC',
        [stage.id]
    );
    return createdEnemies.rows;
};

const loadRunContract = async (client, runId, userId) => {
    const runRes = await client.query(`
        SELECT dr.*,
               r.code,
               r.status AS room_status,
               r.created_by,
               r.difficulty AS room_difficulty,
               r.party_size
        FROM dungeon_runs dr
        JOIN dungeon_rooms r ON r.id = dr.room_id
        WHERE dr.id = $1
    `, [runId]);
    if (runRes.rows.length === 0) {
        return null;
    }

    const runRow = runRes.rows[0];
    const membershipRes = await client.query(
        'SELECT id FROM dungeon_run_members WHERE run_id = $1 AND player_id = $2',
        [runId, userId]
    );
    const roomMembershipRes = await client.query(
        'SELECT id FROM dungeon_room_members WHERE room_id = $1 AND player_id = $2',
        [runRow.room_id, userId]
    );
    if (membershipRes.rows.length === 0 && roomMembershipRes.rows.length === 0 && runRow.created_by !== userId) {
        const forbidden = new Error('No eres parte de esta ejecución.');
        forbidden.statusCode = 403;
        throw forbidden;
    }

    const roomMembersRes = await client.query(`
        SELECT drm.id AS member_id, drm.player_id, drm.is_npc, drm.npc_level, drm.is_ready, drm.is_master, drm.joined_at,
               p.username, p.level AS player_level, p.race, p.stats AS player_stats, p.current_hp AS global_current_hp,
               c.name AS class_name
        FROM dungeon_room_members drm
        LEFT JOIN players p ON p.id = drm.player_id
        LEFT JOIN classes c ON c.id = p.class_id
        WHERE drm.room_id = $1
        ORDER BY drm.joined_at ASC, drm.id ASC
    `, [runRow.room_id]);

    const runMembersRes = await client.query(`
        SELECT drm.id AS run_member_id, drm.player_id, drm.is_npc, drm.npc_level, drm.initial_hp, drm.final_hp, drm.status,
               p.username, p.level AS player_level, p.race, p.stats AS player_stats, p.current_hp AS global_current_hp,
               c.name AS class_name
        FROM dungeon_run_members drm
        LEFT JOIN players p ON p.id = drm.player_id
        LEFT JOIN classes c ON c.id = p.class_id
        WHERE drm.run_id = $1
        ORDER BY drm.id ASC
    `, [runId]);

    const playerIds = [...new Set(
        [...roomMembersRes.rows, ...runMembersRes.rows]
            .map((member) => member.player_id)
            .filter(Boolean)
    )];
    const hydratedPlayers = new Map();
    for (const playerId of playerIds) {
        hydratedPlayers.set(playerId, await hydratePlayer(playerId, client));
    }

    const stagesRes = await client.query(`
        SELECT *
        FROM dungeon_room_stages
        WHERE run_id = $1
        ORDER BY room_number ASC, stage_number ASC
    `, [runId]);
    const stages = stagesRes.rows;
    const currentStage = selectCurrentStage(runRow, stages);

    const enemyRows = currentStage
        ? (await client.query(
            'SELECT * FROM dungeon_stage_enemies WHERE stage_id = $1 ORDER BY id ASC',
            [currentStage.id]
        )).rows
        : [];

    const logRows = (await client.query(`
        SELECT l.*, s.room_number, s.stage_number AS room_stage_number
        FROM dungeon_run_log l
        JOIN dungeon_room_stages s ON s.id = l.stage_id
        WHERE l.run_id = $1
        ORDER BY s.room_number ASC, l.round_number ASC, l.id ASC, l.created_at ASC
        LIMIT 500
    `, [runId])).rows;

    const rewardRows = (await client.query(`
        SELECT r.*, s.room_number, s.completed_at AS stage_completed_at
        FROM dungeon_stage_rewards r
        JOIN dungeon_room_stages s ON s.id = r.stage_id
        WHERE s.run_id = $1
        ORDER BY s.room_number ASC, r.id ASC
    `, [runId])).rows;

    const npcRunMembers = runMembersRes.rows.filter((member) => member.is_npc);
    let npcRunIndex = 0;
    const heroes = roomMembersRes.rows.map((member, index) => {
        const runMember = member.is_npc
            ? npcRunMembers[npcRunIndex++]
            : runMembersRes.rows.find((candidate) => candidate.player_id === member.player_id);

        const hydratedPlayer = member.player_id ? hydratedPlayers.get(member.player_id) : null;
        const playerStats = hydratedPlayer?.total_stats || parseJsonValue(runMember?.player_stats ?? member.player_stats, {});
        const constitution = Number(playerStats?.constitution) || 0;
        const computedMaxHp = member.is_npc
            ? computeNpcStats(runMember?.npc_level || member.npc_level || 1).hp
            : (hydratedPlayer?.calculatedMaxHp || computeMaxHp(constitution));
        const initialHpSource = runMember?.initial_hp ?? hydratedPlayer?.current_hp ?? runMember?.global_current_hp ?? member.global_current_hp ?? computedMaxHp;
        const initialHp = normalizeRunHp(initialHpSource, computedMaxHp);
        const finalHpSource = runMember?.final_hp ?? initialHp;
        const currentHp = normalizeRunHp(finalHpSource, computedMaxHp);

        return {
            member_id: member.member_id,
            run_member_id: runMember?.run_member_id || null,
            player_id: member.player_id,
            username: member.is_npc ? `NPC ${index + 1}` : (runMember?.username || member.username || 'Jugador'),
            member_type: member.is_npc ? 'npc' : 'player',
            is_npc: member.is_npc,
            is_master: !!member.is_master,
            slot_position: index + 1,
            level: member.is_npc ? (runMember?.npc_level || member.npc_level || 1) : (runMember?.player_level || member.player_level || 1),
            class_name: member.is_npc ? 'NPC' : (runMember?.class_name || member.class_name || null),
            race: member.is_npc ? 'NPC' : (runMember?.race || member.race || null),
            current_hp: currentHp,
            max_hp: computedMaxHp,
            initial_hp: initialHp,
            final_hp: currentHp,
            status: runMember?.status || 'alive',
            is_ready: !!member.is_ready
        };
    });

    const enemies = enemyRows.map((enemy) => {
        const defeated = !!enemy.is_defeated || Number(enemy.hp_current) <= 0;
        const currentHp = defeated ? 0 : Math.max(0, Number(enemy.hp_current) || 0);
        return {
            stage_enemy_id: enemy.id,
            enemy_id: enemy.enemy_template_id,
            name: enemy.name,
            image_url: enemy.image_url,
            level: enemy.level,
            current_hp: currentHp,
            max_hp: Number(enemy.hp_max) || 0,
            is_boss: !!enemy.is_boss,
            status: defeated ? 'defeated' : 'alive'
        };
    });

    const stagePayload = buildStagePayload(currentStage, runRow);
    const combatLog = logRows.map((entry, index) => ({
        id: entry.id,
        room_number: entry.room_number,
        stage_number: entry.room_number,
        round_number: entry.round_number,
        sequence: index + 1,
        event_type: entry.entry_type,
        entry_type: entry.entry_type,
        message: entry.message,
        data: parseJsonValue(entry.data, {}),
        created_at: entry.created_at
    }));
    const currentStageLog = stagePayload
        ? combatLog.filter((entry) => entry.stage_number === stagePayload.stage_number)
        : [];

    const rewards = rewardRows.flatMap((reward) => {
        const items = parseJsonValue(reward.items_json, []);
        const createdAt = reward.stage_completed_at;
        const stageNumber = reward.room_number;
        const entries = [];

        if (Number(reward.xp_total) > 0) {
            entries.push({
                id: `${reward.id}:xp`,
                stage_number: stageNumber,
                reward_type: 'xp',
                amount: Number(reward.xp_total),
                item_name: null,
                item_rarity: null,
                assigned_to: null,
                created_at: createdAt
            });
        }
        if (Number(reward.copper_total) > 0) {
            entries.push({
                id: `${reward.id}:copper`,
                stage_number: stageNumber,
                reward_type: 'copper',
                amount: Number(reward.copper_total),
                item_name: null,
                item_rarity: null,
                assigned_to: null,
                created_at: createdAt
            });
        }
        items.forEach((item, itemIndex) => {
            entries.push({
                id: `${reward.id}:item:${itemIndex}`,
                stage_number: stageNumber,
                reward_type: 'item',
                amount: Number(item.quantity) || 1,
                item_name: item.name || item.item_name || 'Objeto',
                item_rarity: item.rarity || null,
                assigned_to: null,
                created_at: createdAt
            });
        });

        return entries;
    });

    const isMaster = runRow.created_by === userId;
    const hasAliveEnemies = enemies.some((enemy) => enemy.status === 'alive');
    const stageCompleted = stagePayload?.status === 'completed';
    const finalStage = !!stagePayload?.is_boss;

    return {
        room: {
            id: runRow.room_id,
            code: runRow.code,
            status: runRow.room_status,
            created_by: runRow.created_by,
            difficulty: runRow.room_difficulty,
            party_size: runRow.party_size
        },
        run: {
            id: runRow.id,
            room_id: runRow.room_id,
            status: runRow.status,
            current_room_number: runRow.current_room_number,
            total_rooms: runRow.total_rooms,
            difficulty: runRow.difficulty,
            started_at: runRow.started_at,
            completed_at: runRow.completed_at
        },
        stage: stagePayload,
        stages: stages.map((stage) => buildStagePayload(stage, runRow)),
        heroes,
        enemies,
        combatLog,
        currentStageLog,
        rewards,
        permissions: {
            isMaster,
            canAttack: !!(runRow.status === 'active' && isMaster && stagePayload && !stageCompleted && hasAliveEnemies),
            canContinue: !!(runRow.status === 'active' && isMaster && stageCompleted && !finalStage),
            canFinish: !!(runRow.status === 'active' && isMaster && stageCompleted && finalStage),
            canLeave: ['waiting', 'ready', 'completed', 'failed', 'cancelled', 'expired'].includes(runRow.room_status)
        }
    };
};

// --- 1. LISTAR TIPOS DE MAZMORRA ---
exports.getDungeonTypes = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT dt.*, e.name as zone_name, e.level_required
            FROM dungeon_types dt
            JOIN expeditions e ON dt.zone_id = e.id
            WHERE dt.is_active = true
            ORDER BY dt.min_level ASC
        `);
        res.json({ success: true, types: result.rows });
    } catch (err) {
        console.error('[DUNGEON] Error getting types:', err);
        res.status(500).json({ message: 'Error cargando tipos de mazmorra.' });
    }
};

// --- 2. CREAR SALA ---
exports.createRoom = async (req, res) => {
    const userId = req.user.id;
    const { dungeonTypeId, difficulty, partySize, isPublic } = req.body;

    if (!dungeonTypeId || !difficulty || !partySize) {
        return res.status(400).json({ message: 'Faltan campos requeridos.' });
    }
    if (![3, 4, 5].includes(partySize)) {
        return res.status(400).json({ message: 'Tamaño de grupo inválido.' });
    }
    if (!['easy', 'normal', 'hard', 'inferno'].includes(difficulty)) {
        return res.status(400).json({ message: 'Dificultad inválida.' });
    }

    const client = await pool.connect();
    let roomId = null;
    try {
        await client.query('BEGIN');

        const typeRes = await client.query('SELECT * FROM dungeon_types WHERE id = $1 AND is_active = true', [dungeonTypeId]);
        if (typeRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Tipo de mazmorra no encontrado.' });
        }

        const playerRes = await client.query('SELECT level FROM players WHERE id = $1', [userId]);
        if (playerRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Jugador no encontrado.' });
        }

        const activeRoom = await client.query(`
            SELECT r.id, r.code, r.status FROM dungeon_rooms r
            JOIN dungeon_room_members m ON m.room_id = r.id
            WHERE m.player_id = $1 AND r.status IN ('waiting', 'ready', 'in_progress', 'resting', 'loot')
            LIMIT 1
        `, [userId]);
        if (activeRoom.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Ya estás en una mazmorra activa. Sal de ella antes de crear otra.' });
        }

        let code;
        let codeExists = true;
        while (codeExists) {
            code = generateCode();
            const check = await client.query('SELECT id FROM dungeon_rooms WHERE code = $1 AND status IN (\'waiting\', \'ready\', \'in_progress\')', [code]);
            codeExists = check.rows.length > 0;
        }

        const expiresAt = new Date(Date.now() + ROOM_EXPIRY_MINUTES * 60 * 1000);
        const publicFlag = isPublic !== undefined ? isPublic : true;
        const accessPassword = !publicFlag && req.body.accessPassword ? req.body.accessPassword.trim() : null;

        if (!publicFlag && !accessPassword) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Las salas privadas requieren una clave de acceso.' });
        }

        const roomRes = await client.query(`
            INSERT INTO dungeon_rooms (code, dungeon_type_id, difficulty, party_size, is_public, created_by, expires_at, access_password)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [code, dungeonTypeId, difficulty, partySize, publicFlag, userId, expiresAt, accessPassword]);

        const room = roomRes.rows[0];
        roomId = room.id;

        await client.query(`
            INSERT INTO dungeon_room_members (room_id, player_id, is_npc, is_master, is_ready)
            VALUES ($1, $2, false, true, true)
        `, [room.id, userId]);

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error creating room:', err);
        return res.status(500).json({ message: 'Error creando sala.' });
    } finally {
        client.release();
    }

    // Fetch full room outside transaction (data is committed)
    try {
        const fullRoom = await getRoomFull(roomId, userId);
        if (!fullRoom) {
            return res.status(500).json({ message: 'Sala creada pero error al cargar datos.' });
        }
        res.json({ success: true, room: fullRoom });
    } catch (err) {
        console.error('[DUNGEON] Error loading room after create:', err);
        res.status(500).json({ message: 'Sala creada pero error al cargar datos.' });
    }
};

// --- 3. LISTAR SALAS PÚBLICAS ---
exports.listRooms = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT r.*, dt.name as dungeon_name, dt.description as dungeon_description,
                   dt.image_url, dt.min_level,
                   p.username as creator_name,
                (SELECT COUNT(*) FROM dungeon_room_members WHERE room_id = r.id) as member_count
            FROM dungeon_rooms r
            JOIN dungeon_types dt ON r.dungeon_type_id = dt.id
            JOIN players p ON r.created_by = p.id
            WHERE r.status = 'waiting' AND r.is_public = true AND r.expires_at > NOW()
            ORDER BY r.created_at DESC
        `);

        const rooms = await Promise.all(result.rows.map(async (room) => {
            const members = await pool.query(`
                SELECT drm.*, p.username
                FROM dungeon_room_members drm
                LEFT JOIN players p ON drm.player_id = p.id
                WHERE drm.room_id = $1
                ORDER BY drm.is_master DESC, drm.joined_at ASC
            `, [room.id]);
            return { ...stripSensitiveFields(room), members: members.rows };
        }));

        res.json({ success: true, rooms });
    } catch (err) {
        console.error('[DUNGEON] Error listing rooms:', err);
        res.status(500).json({ message: 'Error listando salas.' });
    }
};

// --- 4. OBTENER SALA POR CÓDIGO ---
exports.getRoom = async (req, res) => {
    const userId = req.user.id;
    const { code } = req.params;
    try {
        const roomRes = await pool.query('SELECT id FROM dungeon_rooms WHERE code = $1', [code.toUpperCase()]);
        if (roomRes.rows.length === 0) return res.status(404).json({ message: 'Sala no encontrada.' });

        const room = await getRoomFull(roomRes.rows[0].id, userId);
        res.json({ success: true, room });
    } catch (err) {
        console.error('[DUNGEON] Error getting room:', err);
        res.status(500).json({ message: 'Error obteniendo sala.' });
    }
};

// --- 5. UNIRSE A SALA ---
exports.joinRoom = async (req, res) => {
    const userId = req.user.id;
    const { code } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const roomRes = await client.query(
            'SELECT * FROM dungeon_rooms WHERE code = $1 AND status = \'waiting\' AND expires_at > NOW() FOR UPDATE',
            [code.toUpperCase()]
        );
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Sala no disponible o expirada.' });
        }
        const room = roomRes.rows[0];

        if (!room.is_public) {
            const providedPassword = req.body.accessPassword || '';
            if (!room.access_password || providedPassword !== room.access_password) {
                await client.query('ROLLBACK');
                return res.status(403).json({ message: 'Clave de acceso incorrecta.' });
            }
        }

        const activeCheck = await client.query(`
            SELECT r.id FROM dungeon_rooms r
            JOIN dungeon_room_members m ON m.room_id = r.id
            WHERE m.player_id = $1 AND r.status IN ('waiting', 'ready', 'in_progress')
            AND r.id != $2 LIMIT 1
        `, [userId, room.id]);
        if (activeCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Ya estás en otra mazmorra activa. Sal de ella antes de unirte.' });
        }

        const memberCount = (await client.query('SELECT COUNT(*) as cnt FROM dungeon_room_members WHERE room_id = $1 AND is_npc = false', [room.id])).rows[0].cnt;
        if (parseInt(memberCount) >= room.party_size) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Sala llena.' });
        }

        const alreadyMember = await client.query(
            'SELECT id FROM dungeon_room_members WHERE room_id = $1 AND player_id = $2',
            [room.id, userId]
        );
        if (alreadyMember.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Ya estás en esta sala.' });
        }

        await client.query(`
            INSERT INTO dungeon_room_members (room_id, player_id, is_npc, is_master)
            VALUES ($1, $2, false, false)
        `, [room.id, userId]);

        await client.query('COMMIT');

        const fullRoom = await getRoomFull(room.id, userId);
        res.json({ success: true, room: fullRoom });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error joining room:', err);
        res.status(500).json({ message: 'Error al unirse a la sala.' });
    } finally {
        client.release();
    }
};

// --- 6. SALIR DE SALA ---
exports.leaveRoom = async (req, res) => {
    const userId = req.user.id;
    const { code } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const roomRes = await client.query(
            'SELECT * FROM dungeon_rooms WHERE code = $1 AND status IN (\'waiting\', \'ready\') FOR UPDATE',
            [code.toUpperCase()]
        );
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No puedes salir de esta sala.' });
        }
        const room = roomRes.rows[0];

        const memberRes = await client.query(
            'SELECT * FROM dungeon_room_members WHERE room_id = $1 AND player_id = $2 FOR UPDATE',
            [room.id, userId]
        );
        if (memberRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No eres miembro de esta sala.' });
        }

        const member = memberRes.rows[0];

        await client.query('DELETE FROM dungeon_room_members WHERE id = $1', [member.id]);

        const remainingMembers = (await client.query('SELECT COUNT(*) as cnt FROM dungeon_room_members WHERE room_id = $1', [room.id])).rows[0].cnt;

        if (parseInt(remainingMembers) === 0 || member.is_master) {
            await client.query('UPDATE dungeon_rooms SET status = \'cancelled\' WHERE id = $1', [room.id]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Has salido de la sala.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error leaving room:', err);
        res.status(500).json({ message: 'Error al salir de la sala.' });
    } finally {
        client.release();
    }
};

// --- 7. ALTERNAR LISTO ---
exports.toggleReady = async (req, res) => {
    const userId = req.user.id;
    const { code } = req.params;

    try {
        const roomRes = await pool.query('SELECT id, status FROM dungeon_rooms WHERE code = $1', [code.toUpperCase()]);
        if (roomRes.rows.length === 0) return res.status(404).json({ message: 'Sala no encontrada.' });

        const room = roomRes.rows[0];
        if (room.status !== 'waiting') return res.status(400).json({ message: 'La sala no está en estado de espera.' });

        const memberRes = await pool.query(
            'SELECT is_ready, is_master FROM dungeon_room_members WHERE room_id = $1 AND player_id = $2',
            [room.id, userId]
        );
        if (memberRes.rows.length === 0) return res.status(400).json({ message: 'No eres miembro de esta sala.' });

        const member = memberRes.rows[0];
        const newReady = !member.is_ready;

        await pool.query('UPDATE dungeon_room_members SET is_ready = $1 WHERE room_id = $2 AND player_id = $3',
            [newReady, room.id, userId]);

        const fullRoom = await getRoomFull(room.id, userId);
        res.json({ success: true, room: fullRoom });

    } catch (err) {
        console.error('[DUNGEON] Error toggling ready:', err);
        res.status(500).json({ message: 'Error al cambiar estado listo.' });
    }
};

// --- 8. INICIAR MAZMORRA (MASTER) ---
exports.startRun = async (req, res) => {
    const userId = req.user.id;
    const { code } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const roomRes = await client.query(
            'SELECT * FROM dungeon_rooms WHERE code = $1 AND status = \'waiting\' AND expires_at > NOW() FOR UPDATE',
            [code.toUpperCase()]
        );
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Sala no disponible.' });
        }
        const room = roomRes.rows[0];

        const masterCheck = await client.query(
            'SELECT id FROM dungeon_room_members WHERE room_id = $1 AND player_id = $2 AND is_master = true',
            [room.id, userId]
        );
        if (masterCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Solo el maestro puede iniciar.' });
        }

        const humanMembers = (await client.query(
            'SELECT * FROM dungeon_room_members WHERE room_id = $1 AND is_npc = false', [room.id]
        )).rows;

        const readyCount = humanMembers.filter(m => m.is_ready).length;
        if (readyCount !== humanMembers.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No todos los jugadores están listos.' });
        }

        if (humanMembers.length < 1) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Se necesita al menos 1 jugador.' });
        }

        // Consumir 1 entrada del creador al iniciar (contar runs ya iniciadas hoy, excluyendo la actual)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const runCountRes = await client.query(`
            SELECT COUNT(*) as count FROM dungeon_runs dr
            JOIN dungeon_rooms r ON dr.room_id = r.id
            WHERE r.created_by = $1 AND dr.started_at >= $2
              AND dr.status NOT IN ('cancelled', 'failed', 'abandoned', 'expired')
        `, [userId, today]);
        const runsToday = parseInt(runCountRes.rows[0]?.count || 0);
        if (runsToday >= DAILY_RUN_LIMIT) {
            const extraRes = await client.query('SELECT dungeon_extra_entries FROM players WHERE id = $1', [userId]);
            const extra = parseInt(extraRes.rows[0]?.dungeon_extra_entries || 0);
            if (extra <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Has alcanzado el límite de ${DAILY_RUN_LIMIT} mazmorras diarias.` });
            }
            await client.query('UPDATE players SET dungeon_extra_entries = dungeon_extra_entries - 1 WHERE id = $1', [userId]);
        }
        // runsToday < DAILY_RUN_LIMIT -> free daily entry, no DB change needed

        const totalRooms = PARTY_ROOM_MAP[room.party_size] || 6;

        const runRes = await client.query(`
            INSERT INTO dungeon_runs (room_id, dungeon_type_id, difficulty, total_rooms, current_room_number, status)
            VALUES ($1, $2, $3, $4, 1, 'active')
            RETURNING *
        `, [room.id, room.dungeon_type_id, room.difficulty, totalRooms]);
        const run = runRes.rows[0];

        for (const member of humanMembers) {
            const playerStats = await hydratePlayer(member.player_id, client);
            const maxHp = playerStats.calculatedMaxHp || computeMaxHp((playerStats.total_stats?.constitution || 0));
            const initialHp = normalizeRunHp(playerStats.current_hp || maxHp, maxHp);

            await client.query(`
                INSERT INTO dungeon_run_members (run_id, player_id, is_npc, initial_hp, final_hp, status)
                VALUES ($1, $2, false, $3, $3, 'alive')
            `, [run.id, member.player_id, initialHp]);
        }

        const playerLevels = humanMembers.map(m => {
            const p = humanMembers.find(h => h.player_id === m.player_id);
            return p ? 1 : 1;
        });

        for (let i = 0; i < humanMembers.length; i++) {
            const pRes = await client.query('SELECT level FROM players WHERE id = $1', [humanMembers[i].player_id]);
            playerLevels[i] = pRes.rows[0]?.level || 1;
        }
        const avgLevel = Math.round(playerLevels.reduce((a, b) => a + b, 0) / playerLevels.length);

        const dtRes = await client.query('SELECT min_level FROM dungeon_types WHERE id = $1', [room.dungeon_type_id]);
        const dungeonLevel = dtRes.rows[0]?.min_level || 1;
        const npcCount = room.party_size - humanMembers.length;
        for (let i = 0; i < npcCount; i++) {
            const npcStats = computeNpcStats(dungeonLevel);
            await client.query(`
                INSERT INTO dungeon_run_members (run_id, player_id, is_npc, npc_level, initial_hp, final_hp, status)
                VALUES ($1, NULL, true, $2, $3, $3, 'alive')
            `, [run.id, dungeonLevel, npcStats.hp]);
        }

        for (let rn = 1; rn <= totalRooms; rn++) {
            await client.query(`
                INSERT INTO dungeon_room_stages (run_id, room_number, stage_number, status)
                VALUES ($1, $2, 1, 'pending')
            `, [run.id, rn]);
        }

        await client.query(
            'UPDATE dungeon_rooms SET status = \'in_progress\', started_at = NOW() WHERE id = $1',
            [room.id]
        );

        const firstStageRes = await client.query(
            'SELECT * FROM dungeon_room_stages WHERE run_id = $1 AND room_number = 1 ORDER BY stage_number ASC LIMIT 1',
            [run.id]
        );
        if (firstStageRes.rows[0]) {
            await ensureStageEnemies(client, run, firstStageRes.rows[0]);
        }

        await client.query('COMMIT');
        const contract = await loadRunContract(pool, run.id, userId);
        res.json({ success: true, ...contract });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error starting run:', err);
        res.status(500).json({ message: 'Error al iniciar la mazmorra.' });
    } finally {
        client.release();
    }
};

// --- 9. OBTENER ESTADO DE LA EJECUCIÓN ---
exports.getRun = async (req, res) => {
    const userId = req.user.id;
    const { runId } = req.params;
    const runIdNum = assertInteger(runId, 'runId');

    try {
        const contract = await loadRunContract(pool, runIdNum, userId);
        if (!contract) {
            return res.status(404).json({ message: 'Ejecución no encontrada.' });
        }
        res.json({ success: true, ...contract });
    } catch (err) {
        console.error('[DUNGEON] Error getting run:', err);
        res.status(err.statusCode || 500).json({ message: err.message || 'Error obteniendo ejecución.' });
    }
};

// --- 10. AVANZAR SIGUIENTE SALA (COMBATE) ---
exports.advanceRoom = async (req, res) => {
    const userId = req.user.id;
    const { runId } = req.params;

    const runIdNum = assertInteger(runId, 'runId');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const runRes = await client.query('SELECT * FROM dungeon_runs WHERE id = $1 AND status = \'active\' FOR UPDATE', [runIdNum]);
        if (runRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Ejecución no activa.' });
        }
        const run = runRes.rows[0];

        const memberCheck = await client.query(
            'SELECT id FROM dungeon_run_members WHERE run_id = $1 AND player_id = $2 AND is_npc = false',
            [runIdNum, userId]
        );
        if (memberCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'No eres parte de esta ejecución.' });
        }

        const roomOwnerCheck = await client.query(
            'SELECT created_by FROM dungeon_rooms WHERE id = $1',
            [run.room_id]
        );
        if (roomOwnerCheck.rows.length === 0 || roomOwnerCheck.rows[0].created_by !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Solo el maestro de la mazmorra puede avanzar a la siguiente sala.' });
        }

        const stageRes = await client.query(
            'SELECT * FROM dungeon_room_stages WHERE run_id = $1 AND room_number = $2 ORDER BY stage_number ASC LIMIT 1',
            [runIdNum, assertInteger(run.current_room_number, 'current_room_number')]
        );
        if (stageRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No hay sala para avanzar.' });
        }
        const stage = stageRes.rows[0];

        if (stage.status === 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Esta sala ya fue completada.' });
        }

        await client.query(
            'UPDATE dungeon_room_stages SET status = \'in_progress\' WHERE id = $1',
            [stage.id]
        );

        const enemies = await ensureStageEnemies(client, run, stage);

        const runMembers = (await client.query(`
            SELECT drm.*, p.level FROM dungeon_run_members drm
            LEFT JOIN players p ON drm.player_id = p.id
            WHERE drm.run_id = $1
        `, [runIdNum])).rows;

        const party = [];
        for (const member of runMembers) {
            if (member.is_npc) {
                const npcStats = computeNpcStats(member.npc_level || 1);
                party.push({
                    id: member.id,
                    player_id: null,
                    name: `NPC Nv.${member.npc_level}`,
                    is_npc: true,
                    npc_level: member.npc_level,
                    current_hp: normalizeRunHp(member.final_hp ?? npcStats.hp, npcStats.hp),
                    max_hp: npcStats.hp,
                    level: member.npc_level,
                    stats: { strength: 5, dexterity: 5, constitution: 5, intelligence: 3, damage_min: npcStats.damage_min, damage_max: npcStats.damage_max, armor: npcStats.armor },
                    skills: []
                });
            } else {
                const playerData = await hydratePlayer(member.player_id, client);
                const usernameRes = await client.query('SELECT username FROM players WHERE id = $1', [member.player_id]);
                const skillsQuery = `
                    SELECT ps.skill_level, s.name, s.damage_min, s.damage_max, s.heal_amount,
                           s.trigger_chance, s.scaling_stat, s.scaling_factor
                    FROM player_skills ps
                    JOIN skills s ON ps.skill_id = s.id
                    WHERE ps.player_id = $1 AND ps.is_equipped = true
                    ORDER BY ps.slot_index ASC
                `;
                const skills = (await client.query(skillsQuery, [member.player_id])).rows;
                party.push({
                    id: member.id,
                    player_id: member.player_id,
                    name: usernameRes.rows[0]?.username || `Jugador ${member.player_id}`,
                    is_npc: false,
                    current_hp: normalizeRunHp(member.final_hp ?? playerData.current_hp, playerData.calculatedMaxHp || playerData.current_hp || 100),
                    max_hp: playerData.calculatedMaxHp || playerData.current_hp || 100,
                    level: playerData.level || 1,
                    stats: playerData.total_stats || playerData.stats || {},
                    skills
                });
            }
        }

        const combatResult = simulateStageCombat(party, enemies, run.difficulty);

        for (const entry of combatResult.log) {
            await client.query(`
                INSERT INTO dungeon_run_log (run_id, stage_id, round_number, entry_type, message, data)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [runIdNum, stage.id, entry.round || 0, entry.type, entry.message, JSON.stringify(entry)]);
        }

        for (const pState of combatResult.partyState) {
            const member = runMembers.find(m => m.id === pState.id);
            if (member) {
                const newHp = Math.max(0, Math.floor(pState.hp));
                const newStatus = pState.alive ? 'alive' : 'dead';
                await client.query(
                    'UPDATE dungeon_run_members SET final_hp = $1, status = $2 WHERE id = $3',
                    [newHp, newStatus, member.id]
                );
            }
        }

        for (const eState of combatResult.enemyState) {
            await client.query(
                'UPDATE dungeon_stage_enemies SET hp_current = $1, is_defeated = $2 WHERE id = $3',
                [Math.max(0, Math.floor(eState.hp)), !eState.alive, eState.id]
            );
        }

        const stageStatus = combatResult.isWin ? 'completed' : 'failed';

        await client.query('UPDATE dungeon_room_stages SET status = $1, completed_at = NOW() WHERE id = $2', [stageStatus, stage.id]);

        if (combatResult.isWin) {
            const existingRewardRes = await client.query(
                'SELECT id FROM dungeon_stage_rewards WHERE stage_id = $1 LIMIT 1',
                [stage.id]
            );
            if (existingRewardRes.rows.length > 0) {
                await client.query('COMMIT');
                const contract = await loadRunContract(pool, runIdNum, userId);
                return res.json({ success: true, ...contract });
            }

            const rewardSeed = `${runId}-${stage.id}-reward`;
            const rewards = await computeStageRewards(enemies, runMembers.length, run.difficulty, rewardSeed, client);

            await client.query(`
                INSERT INTO dungeon_stage_rewards (stage_id, xp_total, copper_total, items_json)
                VALUES ($1, $2, $3, $4)
            `, [stage.id, rewards.xp_total, rewards.copper_total, JSON.stringify(rewards.items)]);

            const aliveMemberIds = new Set(
                combatResult.partyState.filter((memberState) => memberState.alive).map((memberState) => memberState.id)
            );
            const aliveMembers = runMembers.filter((member) => aliveMemberIds.has(member.id));

            let xpPerMember = Math.floor(rewards.xp_total / Math.max(1, aliveMembers.length));
            if (!Number.isFinite(xpPerMember) || xpPerMember < 0) xpPerMember = 0;
            if (xpPerMember > 500) xpPerMember = 500;

            // Total-run cap: sum XP already given to alive members from completed stages
            const prevXpRes = await client.query(`
                SELECT COALESCE(SUM(r.xp_total), 0) as total FROM dungeon_stage_rewards r
                JOIN dungeon_room_stages s ON r.stage_id = s.id
                WHERE s.run_id = $1 AND s.status = 'completed'
            `, [runIdNum]);
            const prevXpTotal = parseInt(prevXpRes.rows[0]?.total || 0);
            const maxRunXpPerMember = 3000;
            if (prevXpTotal > 0) {
                const prevPerMember = Math.floor(prevXpTotal / Math.max(1, aliveMembers.length));
                if (prevPerMember + xpPerMember > maxRunXpPerMember) {
                    xpPerMember = Math.max(0, maxRunXpPerMember - prevPerMember);
                }
            }

            const copperPerMember = Math.floor(rewards.copper_total / Math.max(1, aliveMembers.length));

            for (const member of aliveMembers) {
                if (!member.is_npc && member.player_id) {
                    const pRes = await client.query('SELECT experience FROM players WHERE id = $1', [member.player_id]);
                    const currentXp = (pRes.rows[0]?.experience || 0) + xpPerMember;
                    await client.query(
                        'UPDATE players SET experience = $1 WHERE id = $2',
                        [currentXp, member.player_id]
                    );
                }
            }

            for (const member of aliveMembers) {
                if (!member.is_npc && member.player_id) {
                    const normalized = normalizeCurrency(0, 0, 0, copperPerMember);
                    await client.query(
                        'UPDATE players SET copper = copper + $1, silver = silver + $2, gold = gold + $3 WHERE id = $4',
                        [normalized.newCopper, normalized.newSilver, normalized.newGold, member.player_id]
                    );
                }
            }
        }

        if (!combatResult.isWin) {
            await client.query(
                'UPDATE dungeon_runs SET status = \'failed\', completed_at = NOW() WHERE id = $1',
                [runIdNum]
            );
            await client.query(
                'UPDATE dungeon_rooms SET status = \'failed\', completed_at = NOW() WHERE id = $1',
                [run.room_id]
            );
            await syncRunMemberHpToPlayers(client, runIdNum);
        }

        await client.query('COMMIT');
        const contract = await loadRunContract(pool, runIdNum, userId);
        res.json({ success: true, ...contract });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error advancing room:', err);
        res.status(500).json({ message: err.message || 'Error al avanzar sala.' });
    } finally {
        client.release();
    }
};

// --- 10b. CONTINUAR A SIGUIENTE SALA (MASTER, POST-COMBAT) ---
exports.continueRoom = async (req, res) => {
    const userId = req.user.id;
    const { runId } = req.params;
    const runIdNum = assertInteger(runId, 'runId');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const runRes = await client.query('SELECT * FROM dungeon_runs WHERE id = $1 AND status = \'active\' FOR UPDATE', [runIdNum]);
        if (runRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Ejecución no activa.' });
        }
        const run = runRes.rows[0];

        const roomOwnerCheck = await client.query(
            'SELECT created_by FROM dungeon_rooms WHERE id = $1',
            [run.room_id]
        );
        if (roomOwnerCheck.rows.length === 0 || roomOwnerCheck.rows[0].created_by !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Solo el maestro puede continuar.' });
        }

        const stageRes = await client.query(
            'SELECT * FROM dungeon_room_stages WHERE run_id = $1 AND room_number = $2 ORDER BY stage_number ASC LIMIT 1',
            [runIdNum, assertInteger(run.current_room_number, 'current_room_number')]
        );
        if (stageRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No hay sala para continuar.' });
        }
        const stage = stageRes.rows[0];
        if (stage.status !== 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'La sala actual no está completada. Debes resolver el combate primero.' });
        }

        const isBoss = run.current_room_number >= run.total_rooms;
        if (isBoss) {
            await client.query(
                'UPDATE dungeon_runs SET status = \'completed\', completed_at = NOW(), current_room_number = $1 WHERE id = $2',
                [run.total_rooms, runIdNum]
            );
            await client.query(
                'UPDATE dungeon_rooms SET status = \'completed\', completed_at = NOW() WHERE id = $1',
                [run.room_id]
            );
            await syncRunMemberHpToPlayers(client, runIdNum);
        } else {
            await client.query(
                'UPDATE dungeon_runs SET current_room_number = current_room_number + 1 WHERE id = $1',
                [runIdNum]
            );
        }

        const postRunRes = await client.query('SELECT * FROM dungeon_runs WHERE id = $1', [runIdNum]);
        const updatedRun = postRunRes.rows[0];
        if (updatedRun?.status === 'active') {
            const nextStageRes = await client.query(
                'SELECT * FROM dungeon_room_stages WHERE run_id = $1 AND room_number = $2 ORDER BY stage_number ASC LIMIT 1',
                [runIdNum, updatedRun.current_room_number]
            );
            if (nextStageRes.rows[0]) {
                await ensureStageEnemies(client, updatedRun, nextStageRes.rows[0]);
            }
        }

        await client.query('COMMIT');
        const contract = await loadRunContract(pool, runIdNum, userId);
        res.json({ success: true, ...contract });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error continuing room:', err);
        res.status(500).json({ message: err.message || 'Error al continuar.' });
    } finally {
        client.release();
    }
};

// --- 11. OBTENER LOG DE COMBATE ---
exports.getRunLog = async (req, res) => {
    const { runId } = req.params;
    const runIdNum = assertInteger(runId, 'runId');
    try {
        const result = await pool.query(`
            SELECT l.*, s.room_number, s.stage_number
            FROM dungeon_run_log l
            JOIN dungeon_room_stages s ON l.stage_id = s.id
            WHERE l.run_id = $1
            ORDER BY s.room_number ASC, s.stage_number ASC, l.round_number ASC, l.id ASC
            LIMIT 500
        `, [runIdNum]);
        res.json({ success: true, log: result.rows });
    } catch (err) {
        console.error('[DUNGEON] Error getting log:', err);
        res.status(500).json({ message: 'Error obteniendo historial.' });
    }
};

// --- 12. ENVIAR GREED ROLL ---
exports.submitRoll = async (req, res) => {
    const userId = req.user.id;
    const { rollId } = req.params;
    const { roll } = req.body;

    if (typeof roll !== 'number' || roll < 1 || roll > 100) {
        return res.status(400).json({ message: 'El roll debe ser un número entre 1 y 100.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const lootRes = await client.query('SELECT * FROM dungeon_loot_rolls WHERE id = $1 AND resolved = false FOR UPDATE', [rollId]);
        if (lootRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Loot no disponible o ya resuelto.' });
        }
        const loot = lootRes.rows[0];

        const isMember = await client.query(
            'SELECT id FROM dungeon_run_members WHERE run_id = $1 AND player_id = $2',
            [loot.run_id, userId]
        );
        if (isMember.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'No eres parte de esta ejecución.' });
        }

        const currentRolls = loot.rolls || [];
        if (currentRolls.some(r => r.player_id === userId)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Ya has tirado por este objeto.' });
        }

        const userRes = await client.query('SELECT username FROM players WHERE id = $1', [userId]);
        const username = userRes.rows[0]?.username || 'Desconocido';

        currentRolls.push({ player_id: userId, player_name: username, roll });
        await client.query('UPDATE dungeon_loot_rolls SET rolls = $1 WHERE id = $2', [JSON.stringify(currentRolls), rollId]);

        await client.query('COMMIT');

        res.json({ success: true, rolls: currentRolls });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error submitting roll:', err);
        res.status(500).json({ message: 'Error al enviar roll.' });
    } finally {
        client.release();
    }
};

// --- 13. MIS EJECUCIONES ACTIVAS ---
exports.getMyActiveRuns = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT dr.*, dt.name as dungeon_name, r.code as room_code
            FROM dungeon_runs dr
            JOIN dungeon_rooms r ON dr.room_id = r.id
            JOIN dungeon_types dt ON dr.dungeon_type_id = dt.id
            JOIN dungeon_run_members drm ON drm.run_id = dr.id
            WHERE drm.player_id = $1 AND dr.status = 'active'
            ORDER BY dr.started_at DESC
            LIMIT 5
        `, [userId]);
        res.json({ success: true, runs: result.rows });
    } catch (err) {
        console.error('[DUNGEON] Error getting active runs:', err);
        res.status(500).json({ message: 'Error obteniendo ejecuciones activas.' });
    }
};

// --- 14. CANCELAR SALA (MASTER) ---
exports.cancelRoom = async (req, res) => {
    const userId = req.user.id;
    const { code } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const roomRes = await client.query(
            'SELECT * FROM dungeon_rooms WHERE code = $1 AND status IN (\'waiting\', \'ready\') FOR UPDATE',
            [code.toUpperCase()]
        );
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Sala no disponible o ya iniciada.' });
        }
        const room = roomRes.rows[0];

        const masterCheck = await client.query(
            'SELECT id FROM dungeon_room_members WHERE room_id = $1 AND player_id = $2 AND is_master = true',
            [room.id, userId]
        );
        if (masterCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Solo el maestro puede cancelar la sala.' });
        }

        await client.query('UPDATE dungeon_rooms SET status = \'cancelled\' WHERE id = $1', [room.id]);

        await client.query('COMMIT');
        res.json({ success: true, message: 'Sala cancelada.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error canceling room:', err);
        res.status(500).json({ message: 'Error al cancelar sala.' });
    } finally {
        client.release();
    }
};

// --- 15. LLENAR HUECOS CON NPC ---
exports.fillNPCs = async (req, res) => {
    const userId = req.user.id;
    const { code } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const roomRes = await client.query(
            'SELECT * FROM dungeon_rooms WHERE code = $1 AND status = \'waiting\' AND expires_at > NOW() FOR UPDATE',
            [code.toUpperCase()]
        );
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Sala no disponible.' });
        }
        const room = roomRes.rows[0];

        const masterCheck = await client.query(
            'SELECT id FROM dungeon_room_members WHERE room_id = $1 AND player_id = $2 AND is_master = true',
            [room.id, userId]
        );
        if (masterCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Solo el maestro puede completar con NPC.' });
        }

        const currentCount = parseInt((await client.query(
            'SELECT COUNT(*) as cnt FROM dungeon_room_members WHERE room_id = $1', [room.id]
        )).rows[0].cnt);

        const dtRes = await client.query('SELECT min_level FROM dungeon_types WHERE id = $1', [room.dungeon_type_id]);
        const dungeonLevel = dtRes.rows[0]?.min_level || 1;

        const npcSlots = room.party_size - currentCount;
        const npcNames = ['Tanque Mercenario', 'Sanadora Rúnica', 'Arquero Fantasma', 'Mago de Hueso', 'Guardia Esquelético'];
        const npcRoles = ['Tanque', 'Sanadora', 'DPS', 'DPS', 'Tanque'];

        for (let i = 0; i < npcSlots; i++) {
            const npcName = npcNames[currentCount + i] || `NPC ${currentCount + i + 1}`;
            const npcRole = npcRoles[currentCount + i] || 'Versátil';
            await client.query(`
                INSERT INTO dungeon_room_members (room_id, player_id, is_npc, npc_level, is_master, is_ready)
                VALUES ($1, NULL, true, $2, false, true)
            `, [room.id, dungeonLevel]);
        }

        await client.query('COMMIT');

        const fullRoom = await getRoomFull(room.id, userId);
        res.json({ success: true, room: fullRoom });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error filling NPCs:', err);
        res.status(500).json({ message: 'Error al completar con NPC.' });
    } finally {
        client.release();
    }
};

// --- 16. MI SALA ACTIVA ---
exports.getMyActiveRoom = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(`
            SELECT r.*, dt.name as dungeon_name, dt.description as dungeon_description,
                   dt.image_url, dt.min_level, p.username as creator_name,
                   (SELECT COUNT(*) FROM dungeon_room_members WHERE room_id = r.id) as member_count,
                   (
                       SELECT dr.id
                       FROM dungeon_runs dr
                       WHERE dr.room_id = r.id
                       ORDER BY dr.started_at DESC NULLS LAST, dr.id DESC
                       LIMIT 1
                   ) as latest_run_id
            FROM dungeon_rooms r
            JOIN dungeon_types dt ON r.dungeon_type_id = dt.id
            JOIN players p ON r.created_by = p.id
            JOIN dungeon_room_members m ON m.room_id = r.id
            WHERE m.player_id = $1 AND r.status IN ('waiting', 'ready', 'in_progress')
            ORDER BY r.created_at DESC
            LIMIT 1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.json({ success: true, room: null });
        }

        const room = result.rows[0];
        const members = (await pool.query(`
            SELECT drm.*, p.username, p.level as player_level
            FROM dungeon_room_members drm
            LEFT JOIN players p ON drm.player_id = p.id
            WHERE drm.room_id = $1
            ORDER BY drm.is_master DESC, drm.joined_at ASC
        `, [room.id])).rows;

        res.json({ success: true, room: { ...stripSensitiveFields(room), members } });
    } catch (err) {
        console.error('[DUNGEON] Error getting active room:', err);
        res.status(500).json({ message: 'Error obteniendo sala activa.' });
    }
};

// --- 17. COMPRAR ENTRADA EXTRA ---
exports.buyEntry = async (req, res) => {
    const userId = req.user.id;
    try {
        const onixRes = await pool.query('SELECT onix, dungeon_extra_entries FROM players WHERE id = $1', [userId]);
        if (onixRes.rows.length === 0) return res.status(404).json({ message: 'Jugador no encontrado.' });
        const { onix, dungeon_extra_entries } = onixRes.rows[0];
        if (parseInt(onix) < ENTRY_PRICE_ONIX) {
            return res.status(400).json({ message: `Necesitas ${ENTRY_PRICE_ONIX} Onix para comprar una entrada extra. Tienes ${onix}.` });
        }
        await pool.query(
            'UPDATE players SET onix = onix - $1, dungeon_extra_entries = dungeon_extra_entries + 1 WHERE id = $2',
            [ENTRY_PRICE_ONIX, userId]
        );
        const updated = (await pool.query('SELECT onix, dungeon_extra_entries FROM players WHERE id = $1', [userId])).rows[0];
        res.json({
            success: true,
            message: `Entrada extra comprada. Te quedan ${updated.onix} Onix.`,
            onix: updated.onix,
            dungeon_extra_entries: updated.dungeon_extra_entries
        });
    } catch (err) {
        console.error('[DUNGEON] Error buying entry:', err);
        res.status(500).json({ message: 'Error al comprar entrada.' });
    }
};

// --- 18. EXPULSAR MIEMBRO (MASTER, SOLO WAITING/READY) ---
exports.kickMember = async (req, res) => {
    const userId = req.user.id;
    const { code } = req.params;
    const { memberId } = req.body;

    if (!memberId) return res.status(400).json({ message: 'Falta memberId.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const roomRes = await client.query(
            'SELECT * FROM dungeon_rooms WHERE code = $1 AND status IN (\'waiting\', \'ready\') FOR UPDATE',
            [code.toUpperCase()]
        );
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Sala no disponible o ya iniciada.' });
        }
        const room = roomRes.rows[0];

        const masterCheck = await client.query(
            'SELECT id FROM dungeon_room_members WHERE room_id = $1 AND player_id = $2 AND is_master = true',
            [room.id, userId]
        );
        if (masterCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Solo el maestro puede expulsar.' });
        }

        const target = await client.query(
            'SELECT * FROM dungeon_room_members WHERE id = $1 AND room_id = $2',
            [memberId, room.id]
        );
        if (target.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Miembro no encontrado.' });
        }
        if (target.rows[0].is_master) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No puedes expulsarte a ti mismo.' });
        }
        if (target.rows[0].player_id === userId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No puedes expulsarte a ti mismo.' });
        }

        await client.query('DELETE FROM dungeon_room_members WHERE id = $1', [memberId]);

        await client.query('COMMIT');

        const fullRoom = await getRoomFull(room.id, userId);
        res.json({ success: true, message: 'Miembro expulsado.', room: fullRoom });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error kicking member:', err);
        res.status(500).json({ message: 'Error al expulsar miembro.' });
    } finally {
        client.release();
    }
};

// --- 19. OBTENER ENTRADAS DEL JUGADOR ---
exports.getMyEntries = async (req, res) => {
    const userId = req.user.id;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const runCountRes = await pool.query(`
            SELECT COUNT(*) as count FROM dungeon_runs dr
            JOIN dungeon_rooms r ON dr.room_id = r.id
            WHERE r.created_by = $1 AND dr.started_at >= $2
              AND dr.status NOT IN ('cancelled', 'failed', 'abandoned', 'expired')
        `, [userId, today]);
        const runsToday = parseInt(runCountRes.rows[0]?.count || 0);

        const playerRes = await pool.query(
            'SELECT dungeon_extra_entries, onix FROM players WHERE id = $1',
            [userId]
        );
        const extraEntries = parseInt(playerRes.rows[0]?.dungeon_extra_entries || 0);
        const onix = parseInt(playerRes.rows[0]?.onix || 0);

        const remainingDaily = Math.max(0, DAILY_RUN_LIMIT - runsToday);
        const totalEntries = remainingDaily + extraEntries;

        res.json({
            success: true,
            runsToday,
            dailyLimit: DAILY_RUN_LIMIT,
            remainingDaily,
            extraEntries,
            totalEntries,
            onix
        });
    } catch (err) {
        console.error('[DUNGEON] Error getting entries:', err);
        res.status(500).json({ message: 'Error obteniendo entradas.' });
    }
};

// --- HELPER: Obtener sala completa ---
const getRoomFull = async (roomId, userId) => {
    const roomRes = await pool.query(`
        SELECT r.*, dt.name as dungeon_name, dt.description as dungeon_description,
               dt.image_url, dt.min_level, dt.zone_id,
               p.username as creator_name,
               (
                   SELECT dr.id
                   FROM dungeon_runs dr
                   WHERE dr.room_id = r.id
                   ORDER BY dr.started_at DESC NULLS LAST, dr.id DESC
                   LIMIT 1
               ) as latest_run_id
        FROM dungeon_rooms r
        JOIN dungeon_types dt ON r.dungeon_type_id = dt.id
        JOIN players p ON r.created_by = p.id
        WHERE r.id = $1
    `, [roomId]);

    if (roomRes.rows.length === 0) return null;
    const room = roomRes.rows[0];

    const memberRows = (await pool.query(`
        SELECT drm.*, p.username, p.level as player_level, p.race, c.name as class_name,
               p.current_hp, p.stats as player_stats
        FROM dungeon_room_members drm
        LEFT JOIN players p ON drm.player_id = p.id
        LEFT JOIN classes c ON c.id = p.class_id
        WHERE drm.room_id = $1
        ORDER BY drm.is_master DESC, drm.joined_at ASC
    `, [roomId])).rows;

    const members = memberRows.map(m => {
        if (m.is_npc) {
            const npcStats = computeNpcStats(m.npc_level || 1);
            return { ...m, current_hp: npcStats.hp, max_hp: npcStats.hp, initial_hp: npcStats.hp };
        }
        const stats = typeof m.player_stats === 'string' ? JSON.parse(m.player_stats) : (m.player_stats || {});
        const constitution = Number(stats.constitution) || 0;
        const maxHp = computeMaxHp(constitution);
        const hp = Math.min(Number(m.current_hp) || maxHp, maxHp);
        return { ...m, current_hp: hp, max_hp: maxHp, initial_hp: maxHp };
    });

    return { ...stripSensitiveFields(room), members };
};
