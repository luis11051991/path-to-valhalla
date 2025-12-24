const pool = require('../config/db');
const { normalizeCurrency } = require('../utils/currencyUtils');
const { processRegeneration } = require('../utils/regenUtils');

// IMPORTANTE: Asegúrate de haber creado el archivo constants/levels.js
let getXpRequiredForLevel;
try {
    const levels = require('../constants/levels');
    getXpRequiredForLevel = levels.getXpRequiredForLevel;
} catch (error) {
    getXpRequiredForLevel = (lvl) => lvl * 100; 
}

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

exports.getExpeditions = async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, name, description, level_required as level_req, energy_cost, duration_seconds, image_url FROM expeditions ORDER BY level_required ASC`);
        res.json({ success: true, expeditions: result.rows });
    } catch (err) { res.status(500).json({ message: 'Error cargando mapa.' }); }
};

exports.getZoneEnemies = async (req, res) => {
    const { zoneId } = req.params;
    try {
        const enemiesRes = await pool.query(`SELECT * FROM enemies WHERE zone_id = $1 AND is_hidden = false ORDER BY difficulty_tier ASC, min_level ASC`, [zoneId]);
        res.json({ success: true, enemies: enemiesRes.rows });
    } catch (err) { res.status(500).json({ message: 'Error cargando enemigos.' }); }
};

// --- MOTOR DE COMBATE ---
exports.startBattle = async (req, res) => {
    const { userId, enemyId, zoneId } = req.body;

    try {
        const preCheck = await pool.query('SELECT * FROM players WHERE id = $1', [userId]);
        if (preCheck.rows.length > 0) await processRegeneration(preCheck.rows[0]);
    } catch (e) { console.error("Error regen:", e); }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const playerRes = await client.query('SELECT * FROM players WHERE id = $1', [userId]);
        const enemyRes = await client.query('SELECT * FROM enemies WHERE id = $1', [enemyId]);
        const zoneRes = await client.query('SELECT * FROM expeditions WHERE id = $1', [zoneId]);

        if (!playerRes.rows[0] || !enemyRes.rows[0]) throw new Error("Datos inválidos");

        const player = playerRes.rows[0];
        const baseEnemy = enemyRes.rows[0];
        const zone = zoneRes.rows[0];

        if (player.level < zone.level_required) throw new Error(`Nivel insuficiente.`);
        if (player.energy < 5) throw new Error("Energía insuficiente.");
        if (player.current_hp <= 5) throw new Error("Estás muy herido.");

        const itemsRes = await client.query(`SELECT pi.*, it.base_stats FROM player_items pi JOIN items_templates it ON pi.template_id = it.id WHERE pi.player_id = $1 AND pi.is_equipped = true`, [userId]);

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

        const enemy = resolveEnemyStats(baseEnemy);
        const playerMaxHp = 100 + (totalCon * 20);
        player.current_hp = Math.min(player.current_hp, playerMaxHp);

        const initialPlayerHp = player.current_hp;
        const initialEnemyHp = enemy.max_hp;

        let log = [];
        let isWin = false;

        for (let r = 1; r <= 10; r++) {
            log.push({ type: 'round', msg: `--- RONDA ${r} ---` });
            const weaponDmg = Math.floor(Math.random() * (bonuses.damage_max - bonuses.damage_min + 1)) + bonuses.damage_min;
            const statDmg = Math.floor(Math.max(totalStr, totalDex) * 2);
            let dmgToEnemy = Math.max(1, (weaponDmg + statDmg) - Math.floor((baseEnemy.armor || 0) / 5));

            enemy.current_hp -= dmgToEnemy;
            log.push({ type: 'player_atk', msg: `Golpeas por ${dmgToEnemy}`, enemyHp: Math.max(0, enemy.current_hp) });

            if (enemy.current_hp <= 0) {
                isWin = true;
                log.push({ type: 'info', msg: "¡Victoria!" });
                break;
            }

            let dmgToPlayer = Math.max(1, enemy.damage - Math.floor((totalArmor + totalCon / 2) / 5));
            player.current_hp -= dmgToPlayer;
            log.push({ type: 'enemy_atk', msg: `Te golpean por ${dmgToPlayer}`, playerHp: Math.max(0, player.current_hp) });

            if (player.current_hp <= 0) {
                isWin = false;
                player.current_hp = 1;
                log.push({ type: 'info', msg: "Derrota." });
                break;
            }
        }

        // --- ACTUALIZACIÓN DE MISIONES (LÓGICA MEJORADA) ---
        let questLogs = [];
        if (isWin) {
            // Buscamos TODAS las misiones activas
            const activeQuestsRes = await client.query(`
                SELECT pq.id, pq.progress, q.title, q.requirements 
                FROM player_quests pq
                JOIN quests q ON pq.quest_id = q.id
                WHERE pq.player_id = $1 AND pq.status = 'active'
            `, [userId]);

            for (const quest of activeQuestsRes.rows) {
                let progress = { ...quest.progress }; 
                let updated = false;
                const requirements = quest.requirements || [];

                for (const req of requirements) {
                    // Verificamos si el ID del enemigo coincide con el requisito
                    if (req.type === 'kill' && parseInt(req.target_id) === parseInt(baseEnemy.id)) {
                        const currentCount = parseInt(progress[req.target_id] || 0);
                        const targetCount = parseInt(req.count);
                        
                        if (currentCount < targetCount) {
                            progress[req.target_id] = currentCount + 1;
                            updated = true;
                            // Agregamos al log de batalla
                            questLogs.push(`📜 ${quest.title}: ${req.name} (${progress[req.target_id]}/${targetCount})`);
                        }
                    }
                }

                if (updated) {
                    await client.query(
                        "UPDATE player_quests SET progress = $1 WHERE id = $2",
                        [JSON.stringify(progress), quest.id]
                    );
                }
            }
        }

        // --- RECOMPENSAS Y LEVEL UP ---
        let rewards = { xp: 0, copper: 0, items: [] };
        let finalGold = parseInt(player.gold || 0);
        let finalSilver = parseInt(player.silver || 0);
        let finalCopper = parseInt(player.copper || 0);
        let currentXp = parseInt(player.experience || 0);
        let currentLevel = parseInt(player.level || 1);
        let currentStatPoints = parseInt(player.stat_points || 0);
        let leveledUp = false;

        if (isWin) {
            const xpGain = baseEnemy.xp_reward || 10;
            rewards.xp = xpGain;
            currentXp += xpGain;

            while (true) {
                const xpNeeded = getXpRequiredForLevel(currentLevel);
                if (currentXp >= xpNeeded) {
                    currentXp -= xpNeeded;
                    currentLevel++;
                    currentStatPoints += 5;
                    leveledUp = true;
                    player.current_hp = 100 + (totalCon * 20); 
                    log.push({ type: 'info', msg: `¡LEVEL UP! Ahora eres nivel ${currentLevel}` });
                } else { break; }
            }

            const minGold = baseEnemy.gold_reward_min || 1;
            const maxGold = baseEnemy.gold_reward_max || 5;
            rewards.copper = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;

            const normalized = normalizeCurrency(player.gold, player.silver, player.copper, rewards.copper);
            finalGold = normalized.newGold;
            finalSilver = normalized.newSilver;
            finalCopper = normalized.newCopper;

            const dropsRes = await client.query('SELECT * FROM enemy_drops WHERE enemy_id = $1', [enemyId]);
            for (const drop of dropsRes.rows) {
                if (Math.random() * 100 <= drop.drop_chance) {
                    const qty = Math.floor(Math.random() * (drop.max_qty - drop.min_qty + 1)) + drop.min_qty;
                    const tplRes = await client.query('SELECT * FROM items_templates WHERE id = $1', [drop.item_template_id]);
                    const template = tplRes.rows[0];
                    let dropStats = (template.type !== 'material' && template.type !== 'consumable') ? generateRandomStats(template.base_stats) : {};

                    await client.query(`
                        INSERT INTO player_packages (player_id, item_template_id, quantity, data)
                        VALUES ($1, $2, $3, $4)
                    `, [userId, drop.item_template_id, qty, dropStats]);

                    rewards.items.push({ name: template.name, qty });
                }
            }
        }

        const durabilityLoss = isWin ? 1 : 2;
        await client.query(`UPDATE player_items SET durability_current = GREATEST(0, durability_current - $1) WHERE player_id = $2 AND is_equipped = true`, [durabilityLoss, userId]);

        await client.query(`
            UPDATE players 
            SET current_hp = $1, energy = energy - 5, experience = $2, level = $3, stat_points = $4,
                gold = $5, silver = $6, copper = $7, last_expedition_at = NOW() 
            WHERE id = $8`,
            [player.current_hp, currentXp, currentLevel, currentStatPoints, finalGold, finalSilver, finalCopper, userId]
        );

        await client.query('COMMIT');

        // INYECTAR LOGS DE QUEST
        if (questLogs.length > 0) {
            // Los ponemos antes del mensaje final de victoria
            questLogs.forEach(msg => log.push({ type: 'info', msg: msg }));
        }

        res.json({
            success: true,
            combatResult: {
                isWin, log, rewards, leveledUp, 
                initialPlayerHp, initialEnemyHp, finalPlayerHp: player.current_hp,
                enemyName: baseEnemy.name, enemyImage: baseEnemy.image_url
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