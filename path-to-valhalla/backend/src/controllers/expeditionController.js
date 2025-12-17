const pool = require('../config/db');
const { giveItemToPlayer } = require('../utils/inventoryUtils');

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

// --- HELPER: Resolve Stats ---
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

// --- 3. MOTOR DE COMBATE V4 (AHORA CON ITEMS) ---
exports.startBattle = async (req, res) => {
    const { userId, enemyId, zoneId } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // A. DATOS
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

        if (player.last_expedition_at) {
            const now = new Date();
            const lastTime = new Date(player.last_expedition_at);
            const diffSeconds = (now - lastTime) / 1000;
            let cd = 10; 
            if (player.level >= 40) cd = 90;
            else if (player.level >= 30) cd = 70;
            else if (player.level >= 20) cd = 50;
            else if (player.level >= 10) cd = 30;
            if (diffSeconds < cd) throw new Error(`Descansando... espera ${Math.ceil(cd - diffSeconds)}s`);
        }

        // --- B. CÁLCULO DE STATS TOTALES (Items + Base) ---
        // Recuperamos los items equipados
        const itemsRes = await client.query(`
            SELECT pi.*, it.base_stats 
            FROM player_items pi 
            JOIN items_templates it ON pi.template_id = it.id 
            WHERE pi.player_id = $1 AND pi.is_equipped = true
        `, [userId]);

        let bonuses = { strength: 0, dexterity: 0, constitution: 0, armor: 0, damage_min: 0, damage_max: 0 };

        itemsRes.rows.forEach(item => {
            const stats = item.base_stats || {}; // Usamos el JSON del template o del item si tuviera únicos
            Object.entries(stats).forEach(([key, val]) => {
                let valToAdd = Array.isArray(val) ? Math.floor((val[0] + val[1]) / 2) : val;
                if (bonuses[key] !== undefined) bonuses[key] += valToAdd;
            });
        });

        // Sumamos Base + Bonus
        const totalStr = (player.stats.strength || 0) + bonuses.strength;
        const totalDex = (player.stats.dexterity || 0) + bonuses.dexterity;
        const totalCon = (player.stats.constitution || 0) + bonuses.constitution;
        const totalArmor = bonuses.armor; // Armadura viene casi toda del equipo

        // --- C. PREPARACIÓN ---
        const enemy = resolveEnemyStats(baseEnemy);
        const playerMaxHp = 100 + (totalCon * 20); // HP real con items
        // Ajustamos HP actual si excede el nuevo máximo (raro en batalla pero posible)
        player.current_hp = Math.min(player.current_hp, playerMaxHp); 

        let log = []; 
        let isWin = false;
        
        // --- D. PELEA ---
        for (let r = 1; r <= 10; r++) {
            log.push({ type: 'round', msg: `--- RONDA ${r} ---` });

            // 1. JUGADOR ATACA
            // Fórmula: (Daño Arma Random) + (Stats Scaling)
            // Scaling: Str * 2 (Igual que en el frontend)
            const weaponDmg = Math.floor(Math.random() * (bonuses.damage_max - bonuses.damage_min + 1)) + bonuses.damage_min;
            const statDmg = Math.floor(Math.max(totalStr, totalDex) * 2); 
            
            let dmgToEnemy = weaponDmg + statDmg;
            
            // Variación pequeña aleatoria (+/- 10%)
            const variance = Math.floor(dmgToEnemy * 0.1);
            dmgToEnemy += Math.floor(Math.random() * (variance * 2 + 1)) - variance;

            // Crítico
            let isCrit = Math.random() * 100 < (5 + (player.stats.luck || 0));
            if (isCrit) dmgToEnemy = Math.floor(dmgToEnemy * 1.5);

            // Reducción enemiga
            const enemyDef = Math.floor((baseEnemy.armor || 0) / 5);
            dmgToEnemy = Math.max(1, dmgToEnemy - enemyDef);

            enemy.current_hp -= dmgToEnemy;
            
            log.push({ 
                type: 'player_atk', 
                msg: `Atacas con ${dmgToEnemy} daño ${isCrit ? '¡CRÍTICO!' : ''}`,
                playerHp: player.current_hp,
                enemyHp: Math.max(0, enemy.current_hp)
            });

            if (enemy.current_hp <= 0) {
                isWin = true;
                log.push({ type: 'info', msg: `${baseEnemy.name} ha caído.` });
                break;
            }

            // 2. ENEMIGO ATACA
            let dmgToPlayer = enemy.damage;
            
            // Tu Defensa (Armor Items + Con/2)
            const playerDef = totalArmor + Math.floor(totalCon / 2);
            dmgToPlayer = Math.max(1, dmgToPlayer - Math.floor(playerDef / 5));

            player.current_hp -= dmgToPlayer;

            log.push({ 
                type: 'enemy_atk', 
                msg: `${baseEnemy.name} te golpea por ${dmgToPlayer} daño.`,
                playerHp: Math.max(0, player.current_hp),
                enemyHp: Math.max(0, enemy.current_hp)
            });

            if (player.current_hp <= 0) {
                isWin = false;
                player.current_hp = 1;
                log.push({ type: 'info', msg: "Has sido derrotado." });
                break;
            }
        }

        if (!isWin && player.current_hp > 1 && enemy.current_hp > 0) {
             const playerPct = player.current_hp / playerMaxHp;
             const enemyPct = enemy.current_hp / enemy.max_hp;
             isWin = playerPct >= enemyPct;
             log.push({ type: 'info', msg: isWin ? "Ganas por resistencia." : "El enemigo te obligó a retirarte." });
        }

        // --- E. RECOMPENSAS ---
        let rewards = { xp: 0, copper: 0, items: [] };
        
        if (isWin) {
            rewards.xp = baseEnemy.xp_reward;
            rewards.copper = Math.floor(Math.random() * 10) + (baseEnemy.min_level * 5);
            const dropsRes = await client.query('SELECT * FROM enemy_drops WHERE enemy_id = $1', [enemyId]);
            for (const drop of dropsRes.rows) {
                if (Math.random() * 100 <= drop.drop_chance) {
                    const qty = Math.floor(Math.random() * (drop.max_qty - drop.min_qty + 1)) + drop.min_qty;
                    await giveItemToPlayer(userId, drop.item_template_id, qty, client);
                    const itemInfo = await client.query('SELECT name FROM items_templates WHERE id = $1', [drop.item_template_id]);
                    rewards.items.push({ name: itemInfo.rows[0].name, qty });
                }
            }
        }

        // Desgaste
        const durabilityLoss = isWin ? 1 : 2;
        await client.query(`UPDATE player_items SET durability_current = GREATEST(0, durability_current - $1) WHERE player_id = $2 AND is_equipped = true`, [durabilityLoss, userId]);

        // Guardar Jugador
        await client.query(`UPDATE players SET current_hp = $1, energy = energy - 5, experience = experience + $2, copper = copper + $3, last_expedition_at = NOW() WHERE id = $4`, 
            [player.current_hp, isWin ? rewards.xp : 0, isWin ? rewards.copper : 0, userId]);

        await client.query('COMMIT');

        res.json({
            success: true,
            combatResult: {
                isWin, log, rewards,
                initialPlayerHp: playerRes.rows[0].current_hp,
                initialEnemyHp: enemy.max_hp,
                finalPlayerHp: player.current_hp,
                enemyName: baseEnemy.name,
                enemyImage: baseEnemy.image_url
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