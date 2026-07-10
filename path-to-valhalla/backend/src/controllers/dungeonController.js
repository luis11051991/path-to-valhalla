const pool = require('../config/db');
const crypto = require('crypto');
const { hydratePlayer, computeMaxHp } = require('../shared/player_stats');
const { simulateStageCombat, generateEnemyForStage, computeNpcStats, DIFFICULTY_MULTIPLIERS } = require('../shared/dungeon_combat');
const { computeStageRewards, createGreedRoll, isGreedItem } = require('../shared/dungeon_loot');
const { getRequiredXp } = require('../shared/level_xp');
const { normalizeCurrency } = require('../utils/currencyUtils');

const PARTY_ROOM_MAP = { 3: 4, 4: 6, 5: 8 };
const ROOM_EXPIRY_MINUTES = 30;
const DAILY_RUN_LIMIT = 3;

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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const roomCountRes = await pool.query(`
            SELECT COUNT(*) as count FROM dungeon_rooms
            WHERE created_by = $1 AND created_at >= $2
              AND status NOT IN ('cancelled', 'failed', 'abandoned', 'expired')
        `, [userId, today]);
        if (parseInt(roomCountRes.rows[0].count) >= DAILY_RUN_LIMIT) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Límite diario de ${DAILY_RUN_LIMIT} mazmorras alcanzado.` });
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

        await client.query(`
            INSERT INTO dungeon_room_members (room_id, player_id, is_npc, is_master, is_ready)
            VALUES ($1, $2, false, true, true)
        `, [room.id, userId]);

        await client.query('COMMIT');

        const fullRoom = await getRoomFull(room.id, userId);
        res.json({ success: true, room: fullRoom });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error creating room:', err);
        res.status(500).json({ message: 'Error creando sala.' });
    } finally {
        client.release();
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

            await client.query(`
                INSERT INTO dungeon_run_members (run_id, player_id, is_npc, initial_hp, final_hp, status)
                VALUES ($1, $2, false, $3, $3, 'alive')
            `, [run.id, member.player_id, Math.floor(playerStats.current_hp)]);
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

        await client.query('COMMIT');

        res.json({
            success: true,
            run: { ...run, total_rooms: totalRooms, current_room_number: 1 }
        });

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
        const runRes = await pool.query(`
            SELECT dr.*, dt.name as dungeon_name, dt.image_url,
                   r.code as room_code
            FROM dungeon_runs dr
            JOIN dungeon_types dt ON dr.dungeon_type_id = dt.id
            JOIN dungeon_rooms r ON dr.room_id = r.id
            WHERE dr.id = $1
        `, [runIdNum]);
        if (runRes.rows.length === 0) return res.status(404).json({ message: 'Ejecución no encontrada.' });

        const run = runRes.rows[0];

        const stageRes = await pool.query(`
            SELECT * FROM dungeon_room_stages WHERE run_id = $1 ORDER BY room_number ASC, stage_number ASC
        `, [runIdNum]);
        const stages = stageRes.rows;

        const currentStage = stages.find(s => s.status === 'in_progress') || stages.find(s => s.status === 'pending');

        let enemies = [];
        let log = [];
        if (currentStage) {
            const enemyRes = await pool.query('SELECT * FROM dungeon_stage_enemies WHERE stage_id = $1', [currentStage.id]);
            enemies = enemyRes.rows;

            const logRes = await pool.query(
                'SELECT * FROM dungeon_run_log WHERE stage_id = $1 ORDER BY round_number ASC, id ASC LIMIT 200',
                [currentStage.id]
            );
            log = logRes.rows;
        }

        const rewardsRes = await pool.query('SELECT * FROM dungeon_stage_rewards WHERE stage_id IN (SELECT id FROM dungeon_room_stages WHERE run_id = $1 AND status = \'completed\')', [runIdNum]);

        const memberRes = await pool.query(`
            SELECT drm.*, p.username
            FROM dungeon_run_members drm
            LEFT JOIN players p ON drm.player_id = p.id
            WHERE drm.run_id = $1
        `, [runIdNum]);

        res.json({
            success: true,
            run,
            stages,
            currentStage,
            enemies,
            log,
            rewards: rewardsRes.rows,
            members: memberRes.rows
        });

    } catch (err) {
        console.error('[DUNGEON] Error getting run:', err);
        res.status(500).json({ message: 'Error obteniendo ejecución.' });
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

        const existingEnemies = await client.query('SELECT COUNT(*) as cnt FROM dungeon_stage_enemies WHERE stage_id = $1', [stage.id]);
        if (parseInt(existingEnemies.rows[0].cnt) === 0) {
            const typeRes = await client.query('SELECT zone_id FROM dungeon_types WHERE id = $1', [run.dungeon_type_id]);
            const zoneId = typeRes.rows[0]?.zone_id;

            const enemyTemplates = (await client.query(`
                SELECT * FROM enemies WHERE zone_id = $1
                ORDER BY difficulty_tier ASC
            `, [zoneId])).rows;

            const isBossRoom = run.current_room_number === run.total_rooms;
            const filteredEnemies = enemyTemplates.filter(e => !e.is_boss || isBossRoom);

            if (filteredEnemies.length === 0 && enemyTemplates.length > 0) {
                filteredEnemies.push(enemyTemplates[0]);
            }

            if (filteredEnemies.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'No hay enemigos configurados para esta zona.' });
            }

            const runMembers = (await client.query(`
                SELECT drm.*, p.level FROM dungeon_run_members drm
                LEFT JOIN players p ON drm.player_id = p.id
                WHERE drm.run_id = $1
            `, [runIdNum])).rows;

            const enemyCount = Math.min(runMembers.length + 1, isBossRoom ? 2 : 4);

            for (let i = 0; i < enemyCount; i++) {
                const template = filteredEnemies[i % filteredEnemies.length];
                const bossOverride = isBossRoom && i === 0 ? { ...template, is_boss: true } : template;
                const seed = `${runId}-${stage.id}-${i}`;
                const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[run.difficulty] || 1.0;
                const enemy = generateEnemyForStage(bossOverride, seed, difficultyMultiplier);

                const enemyValues = [
                    assertInteger(stage.id, 'stage.id'),
                    enemy.enemy_template_id,
                    enemy.name || 'Enemigo',
                    assertInteger(enemy.level, 'enemy.level'),
                    assertInteger(enemy.hp_max, 'enemy.hp_max'),
                    assertInteger(enemy.hp_current, 'enemy.hp_current'),
                    assertInteger(enemy.damage_min, 'enemy.damage_min'),
                    assertInteger(enemy.damage_max, 'enemy.damage_max'),
                    assertInteger(enemy.armor, 'enemy.armor'),
                    enemy.crit_chance || 0,
                    enemy.block_chance || 0,
                    !!enemy.is_boss,
                    !!enemy.is_elite,
                    enemy.image_url || null
                ];

                await client.query(`
                    INSERT INTO dungeon_stage_enemies (stage_id, enemy_template_id, name, level, hp_max, hp_current, damage_min, damage_max, armor, crit_chance, block_chance, is_boss, is_elite, image_url)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, enemyValues);
            }
        }

        const enemies = (await client.query('SELECT * FROM dungeon_stage_enemies WHERE stage_id = $1', [stage.id])).rows;

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
                    current_hp: member.final_hp || npcStats.hp,
                    max_hp: npcStats.hp,
                    level: member.npc_level,
                    stats: { strength: 5, dexterity: 5, constitution: 5, intelligence: 3, damage_min: npcStats.damage_min, damage_max: npcStats.damage_max, armor: npcStats.armor },
                    skills: []
                });
            } else {
                const playerData = await hydratePlayer(member.player_id, client);
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
                    name: `Jugador ${member.player_id}`,
                    is_npc: false,
                    current_hp: member.final_hp || playerData.current_hp,
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
                const newHp = Math.max(1, Math.floor(pState.hp));
                const newStatus = pState.alive ? 'alive' : 'dead';
                await client.query(
                    'UPDATE dungeon_run_members SET final_hp = $1, status = $2 WHERE id = $3',
                    [newHp, newStatus, member.id]
                );
            }
        }

        const defeatedAll = combatResult.enemyState.filter(e => !e.alive).length === enemies.length;
        const stageStatus = combatResult.isWin ? 'completed' : 'failed';

        await client.query('UPDATE dungeon_room_stages SET status = $1, completed_at = NOW() WHERE id = $2', [stageStatus, stage.id]);

        if (combatResult.isWin) {
            const rewardSeed = `${runId}-${stage.id}-reward`;
            const rewards = await computeStageRewards(enemies, runMembers.length, run.difficulty, rewardSeed, client);

            await client.query(`
                INSERT INTO dungeon_stage_rewards (stage_id, xp_total, copper_total, items_json)
                VALUES ($1, $2, $3, $4)
            `, [stage.id, rewards.xp_total, rewards.copper_total, JSON.stringify(rewards.items)]);

            const aliveMembers = runMembers.filter(m => m.status !== 'dead' || true);

            const xpPerMember = Math.floor(rewards.xp_total / Math.max(1, aliveMembers.length));
            const copperPerMember = Math.floor(rewards.copper_total / Math.max(1, aliveMembers.length));

            for (const member of aliveMembers) {
                if (!member.is_npc && member.player_id) {
                    const pRes = await client.query('SELECT experience, level FROM players WHERE id = $1', [member.player_id]);
                    let currentXp = pRes.rows[0]?.experience || 0;
                    let currentLevel = pRes.rows[0]?.level || 1;

                    currentXp += xpPerMember;
                    let leveledUp = false;
                    while (currentXp >= getRequiredXp(currentLevel)) {
                        currentXp -= getRequiredXp(currentLevel);
                        currentLevel++;
                        leveledUp = true;
                    }

                    await client.query(
                        'UPDATE players SET experience = $1, level = $2 WHERE id = $3',
                        [currentXp, currentLevel, member.player_id]
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

            if (combatResult.isWin) {
                const newRoomNumber = run.current_room_number + 1;
                if (newRoomNumber > run.total_rooms) {
                    await client.query(
                        'UPDATE dungeon_runs SET status = \'completed\', completed_at = NOW(), current_room_number = $1 WHERE id = $2',
                        [run.total_rooms, runIdNum]
                    );
                    await client.query(
                        'UPDATE dungeon_rooms SET status = \'completed\', completed_at = NOW() WHERE id = $1',
                        [run.room_id]
                    );
                } else {
                    await client.query(
                        'UPDATE dungeon_runs SET current_room_number = $1 WHERE id = $2',
                        [newRoomNumber, runIdNum]
                    );
                }
            }
        } else {
            await client.query(
                'UPDATE dungeon_runs SET status = \'failed\', completed_at = NOW() WHERE id = $1',
                [runIdNum]
            );
            await client.query(
                'UPDATE dungeon_rooms SET status = \'failed\', completed_at = NOW() WHERE id = $1',
                [run.room_id]
            );
        }

        await client.query('COMMIT');

        const runState = (await pool.query('SELECT * FROM dungeon_runs WHERE id = $1', [runIdNum])).rows[0];
        const updatedEnemies = (await pool.query('SELECT * FROM dungeon_stage_enemies WHERE stage_id = $1', [stage.id])).rows;
        const updatedLog = (await pool.query(
            'SELECT * FROM dungeon_run_log WHERE stage_id = $1 ORDER BY round_number ASC, id ASC LIMIT 200',
            [stage.id]
        )).rows;

        res.json({
            success: true,
            combat: combatResult,
            run: runState,
            enemies: updatedEnemies,
            log: updatedLog,
            stageStatus
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DUNGEON] Error advancing room:', err);
        res.status(500).json({ message: err.message || 'Error al avanzar sala.' });
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
                   (SELECT COUNT(*) FROM dungeon_room_members WHERE room_id = r.id) as member_count
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

// --- HELPER: Obtener sala completa ---
const getRoomFull = async (roomId, userId) => {
    const roomRes = await pool.query(`
        SELECT r.*, dt.name as dungeon_name, dt.description as dungeon_description,
               dt.image_url, dt.min_level, dt.zone_id,
               p.username as creator_name
        FROM dungeon_rooms r
        JOIN dungeon_types dt ON r.dungeon_type_id = dt.id
        JOIN players p ON r.created_by = p.id
        WHERE r.id = $1
    `, [roomId]);

    if (roomRes.rows.length === 0) return null;
    const room = roomRes.rows[0];

    const members = (await pool.query(`
        SELECT drm.*, p.username, p.level as player_level
        FROM dungeon_room_members drm
        LEFT JOIN players p ON drm.player_id = p.id
        WHERE drm.room_id = $1
        ORDER BY drm.is_master DESC, drm.joined_at ASC
    `, [roomId])).rows;

    return { ...stripSensitiveFields(room), members };
};
