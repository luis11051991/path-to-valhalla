const pool = require('../config/db');
const { giveItemToPlayer } = require('../utils/inventoryUtils'); // Importamos el helper

// --- 1. OBTENER MAPA (ZONAS) ---
exports.getExpeditions = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM expeditions ORDER BY level_req ASC');
        res.json({ success: true, expeditions: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error cargando mapa.' });
    }
};

// --- 2. OBTENER ENEMIGOS DE UNA ZONA (Para la selección de cartas) ---
exports.getZoneEnemies = async (req, res) => {
    const { zoneId } = req.params;
    try {
        // Obtenemos todos los enemigos de la zona
        const enemiesRes = await pool.query('SELECT * FROM enemies WHERE zone_id = $1 ORDER BY is_boss ASC', [zoneId]);
        
        // La lógica visual (3 mobs + 1 boss) la haremos aquí o en el frontend.
        // Por ahora devolvemos todos los posibles enemigos de la zona.
        res.json({ success: true, enemies: enemiesRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error cargando enemigos.' });
    }
};

// --- 3. HELPER: CALCULAR STATS REALES DEL ENEMIGO (RNG) ---
const resolveEnemyStats = (enemy) => {
    const stats = enemy.stats || {};
    const resolved = { ...stats }; // Copia base

    // Si tiene rangos en el JSON (ej: strength: [5, 10]), calculamos el valor final
    for (const [key, val] of Object.entries(stats)) {
        if (Array.isArray(val) && val.length === 2) {
            resolved[key] = Math.floor(Math.random() * (val[1] - val[0] + 1)) + val[0];
        } else {
            resolved[key] = val;
        }
    }
    
    // Stats directos (HP, Daño)
    const hp = Math.floor(Math.random() * (enemy.hp_max - enemy.hp_min + 1)) + enemy.hp_min;
    const dmg = Math.floor(Math.random() * (enemy.damage_max - enemy.damage_min + 1)) + enemy.damage_min;

    return { ...resolved, max_hp: hp, current_hp: hp, damage: dmg };
};

// --- 4. MOTOR DE COMBATE V2 ---
exports.startBattle = async (req, res) => {
    const { userId, enemyId, zoneId } = req.body; // zoneId sirve para validar nivel

    const client = await pool.connect(); // Usamos transacción
    try {
        await client.query('BEGIN');

        // A. VALIDACIONES INICIALES
        const playerRes = await client.query('SELECT * FROM players WHERE id = $1', [userId]);
        const enemyRes = await client.query('SELECT * FROM enemies WHERE id = $1', [enemyId]);
        const zoneRes = await client.query('SELECT * FROM expeditions WHERE id = $1', [zoneId]);

        if (!playerRes.rows[0] || !enemyRes.rows[0]) throw new Error("Datos inválidos");
        
        const player = playerRes.rows[0];
        const baseEnemy = enemyRes.rows[0];
        const zone = zoneRes.rows[0];

        // Validar Nivel de Zona
        if (player.level < zone.level_req) throw new Error(`Nivel insuficiente. Requieres ${zone.level_req}.`);

        // Validar Cooldown (Enfriamiento)
        if (player.last_expedition_at) {
            const now = new Date();
            const lastTime = new Date(player.last_expedition_at);
            const diffSeconds = (now - lastTime) / 1000;

            let cooldownNeeded = 10; // Default
            if (player.level >= 40) cooldownNeeded = 90;
            else if (player.level >= 30) cooldownNeeded = 70;
            else if (player.level >= 20) cooldownNeeded = 50;
            else if (player.level >= 10) cooldownNeeded = 30;

            if (diffSeconds < cooldownNeeded) {
                const remaining = Math.ceil(cooldownNeeded - diffSeconds);
                throw new Error(`Debes descansar. Espera ${remaining}s.`);
            }
        }

        // Validar Energía y Vida
        if (player.energy < 5) throw new Error("Energía insuficiente (Req: 5).");
        if (player.current_hp <= 5) throw new Error("Estás muy herido.");

        // B. PREPARAR COMBATIENTES
        const enemy = resolveEnemyStats(baseEnemy); // Instancia única del enemigo con stats resueltos
        
        // Cargar Skills del Jugador
        const skillsRes = await client.query(`
            SELECT s.* FROM player_skills ps 
            JOIN skills s ON ps.skill_id = s.id 
            WHERE ps.player_id = $1 AND ps.is_equipped = true
        `, [userId]);
        const playerSkills = skillsRes.rows;

        // C. BUCLE DE COMBATE (10 RONDAS)
        let log = [];
        let playerDmgTotal = 0;
        let enemyDmgTotal = 0;
        let rounds = 0;
        let isWin = false;

        for (let r = 1; r <= 10; r++) {
            rounds = r;
            log.push({ type: 'round', text: `--- RONDA ${r} ---` });

            // --- TURNO JUGADOR ---
            // 1. Decidir ataque (Skill o Básico)
            let playerMoveDamage = 0;
            let moveName = "Ataque Básico";
            let didCrit = false;

            // Probabilidad de usar Skill (Si tiene energía suficiente, simulado por ahora sin coste MP)
            const activeSkill = playerSkills.find(s => (Math.random() * 100) < (s.activation_chance || 20));
            
            if (activeSkill) {
                moveName = activeSkill.name;
                // Calculamos daño de skill (simplificado: daño base + scaling)
                let baseSkillDmg = Math.floor(Math.random() * (activeSkill.damage_max - activeSkill.damage_min + 1)) + activeSkill.damage_min;
                // Scaling (ej: 1.5 * fuerza)
                const statVal = player.stats[activeSkill.scaling_stat] || 0;
                playerMoveDamage = Math.floor(baseSkillDmg + (statVal * (activeSkill.scaling_factor || 1)));
            } else {
                // Ataque básico (basado en Fuerza o Destreza mayor)
                const mainStat = Math.max(player.stats.strength || 0, player.stats.dexterity || 0);
                playerMoveDamage = Math.floor(mainStat / 2) + Math.floor(Math.random() * 5);
            }

            // 2. Aplicar Armadura Enemiga
            const enemyArmor = baseEnemy.armor || 0;
            const dmgReduction = Math.floor(enemyArmor / 5);
            let finalDmgToEnemy = Math.max(1, playerMoveDamage - dmgReduction);

            // 3. Probabilidad de Crítico Jugador (base 5% + suerte)
            const playerCritChance = 5 + Math.floor((player.stats.luck || 0) / 2);
            if (Math.random() * 100 < playerCritChance) {
                finalDmgToEnemy = Math.floor(finalDmgToEnemy * 1.5);
                didCrit = true;
            }

            // 4. Aplicar Daño
            enemy.current_hp -= finalDmgToEnemy;
            playerDmgTotal += finalDmgToEnemy;

            log.push({ 
                type: 'player_atk', 
                msg: `Usas ${moveName} ${didCrit ? '¡CRÍTICO!' : ''} y haces ${finalDmgToEnemy} de daño.` 
            });

            // CHECK VICTORIA (HP < 1)
            if (enemy.current_hp <= 1) {
                log.push({ type: 'info', msg: `${baseEnemy.name} cae derrotado.` });
                isWin = true;
                break;
            }

            // --- TURNO ENEMIGO ---
            // El enemigo ataca básico (o skill si tuviera, por ahora básico)
            let enemyRawDmg = enemy.damage;
            
            // Armadura Jugador (CON / 2 + Items si tuviéramos defensa total)
            const playerArmor = Math.floor((player.stats.constitution || 0) / 2); 
            let finalDmgToPlayer = Math.max(1, enemyRawDmg - Math.floor(playerArmor / 5));

            // Crítico Enemigo
            if (Math.random() * 100 < (baseEnemy.crit_chance || 10)) {
                finalDmgToPlayer = Math.floor(finalDmgToPlayer * 1.5);
                log.push({ type: 'enemy_atk', msg: `¡${baseEnemy.name} te asesta un GOLPE CRÍTICO de ${finalDmgToPlayer}!` });
            } else {
                log.push({ type: 'enemy_atk', msg: `${baseEnemy.name} te ataca causando ${finalDmgToPlayer} de daño.` });
            }

            // Bloqueo Jugador? (Opcional, basado en escudo)

            player.current_hp -= finalDmgToPlayer;
            enemyDmgTotal += finalDmgToPlayer;

            // CHECK DERROTA
            if (player.current_hp <= 1) {
                log.push({ type: 'info', msg: "Has caído en combate..." });
                isWin = false;
                break;
            }
        }

        // D. RESOLUCIÓN FINAL (Si se acabaron las rondas)
        if (!isWin && player.current_hp > 1 && enemy.current_hp > 1) {
            log.push({ type: 'info', msg: "¡Tiempo agotado! Se compara el daño total..." });
            log.push({ type: 'info', msg: `Tú: ${playerDmgTotal} vs Enemigo: ${enemyDmgTotal}` });
            
            if (playerDmgTotal >= enemyDmgTotal) isWin = true;
            else isWin = false;
        }

        // E. RECOMPENSAS Y ACTUALIZACIÓN
        let rewards = { xp: 0, copper: 0, items: [] };
        
        if (isWin) {
            // 1. XP y Oro
            rewards.xp = baseEnemy.xp_reward;
            rewards.copper = Math.floor(Math.random() * 10) + (baseEnemy.min_level * 5); // Fórmula simple de oro

            // 2. Drops (Ítems)
            const dropsRes = await client.query('SELECT * FROM enemy_drops WHERE enemy_id = $1', [enemyId]);
            for (const drop of dropsRes.rows) {
                const roll = Math.random() * 100;
                if (roll <= drop.drop_chance) {
                    const qty = Math.floor(Math.random() * (drop.max_qty - drop.min_qty + 1)) + drop.min_qty;
                    // Dar ítem al jugador
                    await giveItemToPlayer(userId, drop.item_template_id, qty, client);
                    
                    // Agregar nombre al log de recompensas (consulta rápida para el nombre)
                    const itemNameRes = await client.query('SELECT name FROM items_templates WHERE id = $1', [drop.item_template_id]);
                    rewards.items.push({ name: itemNameRes.rows[0].name, qty });
                }
            }
        }

        // F. GUARDAR CAMBIOS EN EL JUGADOR
        // Consumir energía (5), actualizar vida, dar XP/Oro, poner cooldown
        const hpLost = Math.max(0, playerRes.rows[0].current_hp - player.current_hp); // Calculamos diferencia real
        
        await client.query(`
            UPDATE players 
            SET current_hp = $1, 
                energy = energy - 5, 
                experience = experience + $2, 
                copper = copper + $3,
                last_expedition_at = NOW()
            WHERE id = $4
        `, [
            Math.max(1, player.current_hp), // Nunca bajar de 1 en DB por si acaso
            isWin ? rewards.xp : 0,
            isWin ? rewards.copper : 0,
            userId
        ]);

        // Registrar Log en Historial (Opcional, tabla expedition_logs)
        await client.query(
            'INSERT INTO expedition_logs (player_id, expedition_id, success, log_text, rewards) VALUES ($1, $2, $3, $4, $5)',
            [userId, zoneId, isWin, JSON.stringify(log), JSON.stringify(rewards)]
        );

        await client.query('COMMIT');

        // G. RESPUESTA AL FRONTEND
        res.json({
            success: true,
            combatResult: {
                isWin,
                log,
                rewards,
                finalPlayerHp: player.current_hp,
                enemyImage: baseEnemy.image_url,
                enemyName: baseEnemy.name
            }
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message || 'Error en batalla' });
    } finally {
        client.release();
    }
};