const pool = require('../config/db');
// Nota: Ya no necesitamos giveItemToPlayer porque los drops van a paquetes
const { normalizeCurrency } = require('../utils/currencyUtils');
const { processRegeneration } = require('../utils/regenUtils');

// --- HELPER: RNG para Stats (Usado al crear el paquete de equipo) ---
const generateRandomStats = (templateStats) => {
    const finalStats = {};
    if (!templateStats) return {};
    for (const [key, value] of Object.entries(templateStats)) {
        if (Array.isArray(value) && value.length === 2) {
            finalStats[key] = Math.floor(Math.random() * (value[1] - value[0] + 1)) + value[0];
        } else {
            finalStats[key] = value;
        }
    }
    return finalStats;
};

// --- HELPER: Resolve Enemy Stats (Para el combate) ---
const resolveEnemyStats = (enemy) => {
    const stats = enemy.stats || {};
    const resolved = { ...stats };
    for (const [key, val] of Object.entries(stats)) {
        if (Array.isArray(val) && val.length === 2) {
            resolved[key] = Math.floor(Math.random() * (val[1] - val[0] + 1)) + val[0];
        } else {
            resolved[key] = val;
        }
    }
    const hp = Math.floor(Math.random() * (enemy.hp_max - enemy.hp_min + 1)) + enemy.hp_min;
    const dmg = Math.floor(Math.random() * (enemy.damage_max - enemy.damage_min + 1)) + enemy.damage_min;
    return { ...resolved, max_hp: hp, current_hp: hp, damage: dmg };
};

// --- 1. OBTENER ZONAS ---
exports.getExpeditions = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM expeditions ORDER BY level_req ASC');
        res.json({ success: true, expeditions: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error cargando mapa.' });
    }
};

// --- 2. OBTENER ENEMIGOS ---
exports.getZoneEnemies = async (req, res) => {
    const { zoneId } = req.params;
    try {
        const enemiesRes = await pool.query('SELECT * FROM enemies WHERE zone_id = $1 ORDER BY min_level ASC, is_boss ASC', [zoneId]);
        res.json({ success: true, enemies: enemiesRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error cargando enemigos.' });
    }
};

// ==========================================
// 3. MOTOR DE COMBATE V2 (Corrección Animación e Imágenes)
// ==========================================
exports.startBattle = async (req, res) => {
    const { userId, enemyId, zoneId } = req.body;

    // Paso Previo: Regenerar al jugador
    try {
        const preCheck = await pool.query('SELECT * FROM players WHERE id = $1', [userId]);
        if (preCheck.rows.length > 0) {
            await processRegeneration(preCheck.rows[0]);
        }
    } catch (e) { console.error("Error regen pre-batalla", e); }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // A. DATOS BASE
        const playerRes = await client.query('SELECT * FROM players WHERE id = $1', [userId]);
        const enemyRes = await client.query('SELECT * FROM enemies WHERE id = $1', [enemyId]);
        const zoneRes = await client.query('SELECT * FROM expeditions WHERE id = $1', [zoneId]);

        if (!playerRes.rows[0] || !enemyRes.rows[0]) throw new Error("Datos inválidos");

        const player = playerRes.rows[0];
        const baseEnemy = enemyRes.rows[0];
        const zone = zoneRes.rows[0];

        // --- VALIDACIONES ---
        if (player.level < zone.level_req) throw new Error(`Nivel insuficiente.`);
        if (player.energy < 5) throw new Error("Energía insuficiente.");
        if (player.current_hp <= 5) throw new Error("Estás muy herido.");

        // Cooldown simple
        if (player.last_expedition_at) {
            const now = new Date();
            const lastTime = new Date(player.last_expedition_at);
            const diffSeconds = (now - lastTime) / 1000;
            let cd = 10;
            if (diffSeconds < cd) throw new Error(`Descansando... espera ${Math.ceil(cd - diffSeconds)}s`);
        }

        // --- B. CÁLCULO DE STATS JUGADOR ---
        const itemsRes = await client.query(`
            SELECT pi.*, it.base_stats 
            FROM player_items pi 
            JOIN items_templates it ON pi.template_id = it.id 
            WHERE pi.player_id = $1 AND pi.is_equipped = true
        `, [userId]);

        let bonuses = { strength: 0, dexterity: 0, constitution: 0, armor: 0, damage_min: 0, damage_max: 0 };
        itemsRes.rows.forEach(item => {
            const stats = item.base_stats || {};
            Object.entries(stats).forEach(([key, val]) => {
                let valToAdd = Array.isArray(val) ? Math.floor((val[0] + val[1]) / 2) : val;
                if (bonuses[key] !== undefined) bonuses[key] += valToAdd;
            });
        });

        const totalStr = (player.stats.strength || 0) + bonuses.strength;
        const totalDex = (player.stats.dexterity || 0) + bonuses.dexterity;
        const totalCon = (player.stats.constitution || 0) + bonuses.constitution;
        const totalArmor = bonuses.armor;

        // --- C. PREPARACIÓN COMBATE ---
        const enemy = resolveEnemyStats(baseEnemy);
        const playerMaxHp = 100 + (totalCon * 20);
        player.current_hp = Math.min(player.current_hp, playerMaxHp);

        // [FIX] GUARDAR ESTADO INICIAL PARA LA ANIMACIÓN
        const initialPlayerHp = player.current_hp;
        const initialEnemyHp = enemy.max_hp; // Los enemigos siempre empiezan full en este motor

        let log = [];
        let isWin = false;

        // --- D. PELEA (Motor por Turnos) ---
        for (let r = 1; r <= 10; r++) {
            log.push({ type: 'round', msg: `--- RONDA ${r} ---` });

            // Player Atk
            const weaponDmg = Math.floor(Math.random() * (bonuses.damage_max - bonuses.damage_min + 1)) + bonuses.damage_min;
            const statDmg = Math.floor(Math.max(totalStr, totalDex) * 2);
            let dmgToEnemy = Math.max(1, (weaponDmg + statDmg) - Math.floor((baseEnemy.armor || 0) / 5));

            enemy.current_hp -= dmgToEnemy;
            // Guardamos enemyHp actual para que la barra baje en el frontend
            log.push({ type: 'player_atk', msg: `Golpeas por ${dmgToEnemy}`, enemyHp: Math.max(0, enemy.current_hp) });

            if (enemy.current_hp <= 0) {
                isWin = true;
                log.push({ type: 'info', msg: "¡Victoria!" });
                break;
            }

            // Enemy Atk
            let dmgToPlayer = Math.max(1, enemy.damage - Math.floor((totalArmor + totalCon / 2) / 5));
            player.current_hp -= dmgToPlayer;
            // Guardamos playerHp actual para que la barra baje
            log.push({ type: 'enemy_atk', msg: `Te golpean por ${dmgToPlayer}`, playerHp: Math.max(0, player.current_hp) });

            if (player.current_hp <= 0) {
                isWin = false;
                player.current_hp = 1;
                log.push({ type: 'info', msg: "Derrota." });
                break;
            }
        }

        // --- E. RECOMPENSAS & PAQUETES ---
        let rewards = { xp: 0, copper: 0, items: [] };

        let finalGold = parseInt(player.gold || 0);
        let finalSilver = parseInt(player.silver || 0);
        let finalCopper = parseInt(player.copper || 0);

        if (isWin) {
            rewards.xp = baseEnemy.xp_reward;
            rewards.copper = Math.floor(Math.random() * 10) + (baseEnemy.min_level * 5);

            // Normalizar Moneda
            const normalized = normalizeCurrency(player.gold, player.silver, player.copper, rewards.copper);
            finalGold = normalized.newGold;
            finalSilver = normalized.newSilver;
            finalCopper = normalized.newCopper;

            // Drops -> PAQUETES
            const dropsRes = await client.query('SELECT * FROM enemy_drops WHERE enemy_id = $1', [enemyId]);
            for (const drop of dropsRes.rows) {
                if (Math.random() * 100 <= drop.drop_chance) {
                    const qty = Math.floor(Math.random() * (drop.max_qty - drop.min_qty + 1)) + drop.min_qty;
                    const tplRes = await client.query('SELECT * FROM items_templates WHERE id = $1', [drop.item_template_id]);
                    const template = tplRes.rows[0];

                    let dropStats = {};
                    if (template.type !== 'material' && template.type !== 'consumable') {
                        dropStats = generateRandomStats(template.base_stats);
                    }

                    await client.query(`
                        INSERT INTO player_packages (player_id, item_template_id, quantity, data)
                        VALUES ($1, $2, $3, $4)
                    `, [userId, drop.item_template_id, qty, dropStats]);

                    rewards.items.push({ name: template.name, qty });
                }
            }
        }

        // Desgaste y Update Player
        const durabilityLoss = isWin ? 1 : 2;
        await client.query(`UPDATE player_items SET durability_current = GREATEST(0, durability_current - $1) WHERE player_id = $2 AND is_equipped = true`, [durabilityLoss, userId]);

        await client.query(`
            UPDATE players 
            SET current_hp = $1, 
                energy = energy - 5, 
                experience = experience + $2, 
                gold = $3, silver = $4, copper = $5, 
                last_expedition_at = NOW() 
            WHERE id = $6`,
            [player.current_hp, isWin ? rewards.xp : 0, finalGold, finalSilver, finalCopper, userId]
        );

        await client.query('COMMIT');

        // [FIX] ENVIAMOS LOS DATOS QUE FALTABAN PARA EL FRONTEND
        res.json({
            success: true,
            combatResult: {
                isWin,
                log,
                rewards,
                initialPlayerHp, // CRUCIAL PARA LA BARRA
                initialEnemyHp,  // CRUCIAL PARA LA BARRA
                finalPlayerHp: player.current_hp,
                enemyName: baseEnemy.name,
                enemyImage: baseEnemy.image_url // CRUCIAL PARA LA FOTO
            }
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
};