const pool = require('../config/db');
const { normalizeCurrency } = require('../utils/currencyUtils');
const { hydratePlayer, computeMaxHp } = require('../shared/player_stats');
const achievementService = require('../services/achievementService');
const statisticsService = require('../services/statisticsService');

// XP rules live in the shared module
const { getRequiredXp } = require('../shared/level_xp');
const { computeEnemyXp, computeEnemyLevel } = require('../shared/xp_rewards');
const { generateEnemyInstance, randomInt, seededRandom } = require('../shared/enemy_generator');
const { getPetExpGainFromEnemy, getPetHungerCostFromEnemy, applyPetExperience } = require('../shared/pet_xp');

const generateRandomStats = (templateStats, rng) => {
    const finalStats = {};
    if (!templateStats) return {};
    for (const [key, value] of Object.entries(templateStats)) {
        if (Array.isArray(value) && value.length === 2) {
            const roll = rng ? rng() : Math.random();
            finalStats[key] = Math.floor(roll * (value[1] - value[0] + 1)) + value[0];
        } else {
            finalStats[key] = value;
        }
    }
    return finalStats;
};

// --- OBTENER BESTIARIO ---
exports.getBestiary = async (req, res) => {
    const userId = req.user?.id;
    try {
        const query = `
            SELECT 
                e.*,
                COALESCE(pb.kills, 0) as kills,
                pb.first_kill_at,
                (
                    SELECT json_agg(json_build_object(
                        'name', it.name, 
                        'rarity', it.rarity, 
                        'chance', ed.drop_chance,
                        'image_url', it.image_url
                    ))
                    FROM enemy_drops ed
                    JOIN items_templates it ON ed.item_template_id = it.id
                    WHERE ed.enemy_id = e.id
                ) as drops
            FROM enemies e
            LEFT JOIN player_bestiary pb ON e.id = pb.enemy_id AND pb.player_id = $1
            WHERE pb.enemy_id IS NOT NULL
               OR COALESCE(e.spawn_context, 'expedition') IN ('expedition', 'all')
            ORDER BY e.min_level ASC, e.difficulty_tier ASC
        `;
        
        const result = await pool.query(query, [userId]);
        
        const processedBestiary = result.rows.map(enemy => {
            const weakSim = generateEnemyInstance({ ...enemy, min_level: enemy.min_level, max_level: enemy.min_level }, 'sim-weak', 'bestiary');
            const strongSim = generateEnemyInstance({ ...enemy, min_level: enemy.max_level, max_level: enemy.max_level }, 'sim-strong', 'bestiary');

            return {
                ...enemy,
                calculated_stats: {
                    damage: `${weakSim.damage_min} - ${strongSim.damage_max}`,
                    hp: `${weakSim.hp_max} - ${strongSim.hp_max}`,
                    armor: `${weakSim.armor} - ${strongSim.armor}`,
                    crit: `${weakSim.crit_chance}%`,
                    block: `${weakSim.block_chance}%`
                }
            };
        });

        res.json({ success: true, bestiary: processedBestiary });
    } catch (err) {
        console.error("[BESTIARY ERROR]", err.message);
        res.status(500).json({ message: 'Error cargando el bestiario.' });
    }
};

exports.getExpeditions = async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, name, description, level_required as level_req, energy_cost, duration_seconds, image_url FROM expeditions ORDER BY level_required ASC`);
        res.json({ success: true, expeditions: result.rows });
    } catch (err) { res.status(500).json({ message: 'Error cargando mapa.' }); }
};

exports.getZoneEnemies = async (req, res) => {
    const { zoneId } = req.params;
    const userId = req.user?.id;

    try {
        const activeQuestsRes = await pool.query(`
            SELECT pq.progress, q.requirements
            FROM player_quests pq
            JOIN quests q ON pq.quest_id = q.id
            WHERE pq.player_id = $1 AND pq.status = 'active'
        `, [userId]);

        const visibleHiddenIds = [];
        for (const quest of activeQuestsRes.rows) {
            const requirements = quest.requirements || [];
            const progress = quest.progress || {};
            for (const req of requirements) {
                if (req?.type !== 'kill') continue;
                const targetId = Number(req.target_id);
                const requiredCount = Number(req.count || 0);
                const currentCount = Number(progress[req.target_id] || 0);
                if (Number.isFinite(targetId) && currentCount < requiredCount) {
                    visibleHiddenIds.push(targetId);
                }
            }
        }

        const enemiesRes = await pool.query(
            `SELECT *
             FROM enemies
             WHERE zone_id = $1
               AND COALESCE(spawn_context, 'expedition') IN ('expedition', 'all')
               AND (is_hidden = false OR id = ANY($2))
             ORDER BY difficulty_tier ASC, min_level ASC, id ASC`,
            [zoneId, visibleHiddenIds]
        );

        const enemies = enemiesRes.rows.map(e => ({
            ...e,
            computed_xp_reward: computeEnemyXp({ enemy: e, playerLevel: computeEnemyLevel(e), enemyLevel: computeEnemyLevel(e) })
        }));
        res.json({ success: true, enemies });
    } catch (err) { res.status(500).json({ message: 'Error cargando enemigos.' }); }
};

// --- MOTOR DE COMBATE (CORREGIDO) ---
exports.startBattle = async (req, res) => {
    const { userId, enemyId, zoneId } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const playerRes = await client.query('SELECT * FROM players WHERE id = $1', [userId]);
        const enemyRes = await client.query(
            `SELECT *
             FROM enemies
             WHERE id = $1
               AND zone_id = $2
               AND COALESCE(spawn_context, 'expedition') IN ('expedition', 'all')`,
            [enemyId, zoneId]
        );
        const zoneRes = await client.query('SELECT * FROM expeditions WHERE id = $1', [zoneId]);

        if (!playerRes.rows[0] || !enemyRes.rows[0]) throw new Error("Datos inválidos");

        let player = await hydratePlayer(playerRes.rows[0], client);
        const baseEnemy = enemyRes.rows[0];
        const zone = zoneRes.rows[0];

        if (player.level < zone.level_required) throw new Error(`Nivel insuficiente.`);
        if (player.energy < 5) throw new Error("Energía insuficiente.");
        if (player.current_hp <= 5) throw new Error("Estás muy herido.");

        // --- STATS JUGADOR ---
        const totalStats = player.total_stats || player.stats || {};
        const totalStr = totalStats.strength || 0;
        const totalDex = totalStats.dexterity || 0;
        const totalInt = totalStats.intelligence || 0; 
        const totalCon = totalStats.constitution || 0;
        const totalArmor = (totalStats.armor || 0) + (totalStats.defense || 0);

        const weaponMin = Math.max(0, totalStats.damage_min || 0);
        const weaponMax = Math.max(weaponMin, totalStats.damage_max || weaponMin);

        // --- SKILLS ---
        const skillsQuery = `
            SELECT ps.skill_level, s.name, s.damage_min, s.damage_max, s.heal_amount, 
                   s.trigger_chance, s.scaling_stat, s.scaling_factor
            FROM player_skills ps
            JOIN skills s ON ps.skill_id = s.id
            WHERE ps.player_id = $1 AND ps.is_equipped = true
            ORDER BY ps.slot_index ASC
        `;
        const equippedSkills = (await client.query(skillsQuery, [userId])).rows;

        // --- GENERAR ENEMIGO ---
        const enemyInstance = generateEnemyInstance(baseEnemy, userId, zoneId);
        const playerMaxHp = player.calculatedMaxHp || computeMaxHp(totalCon);
        player.current_hp = Math.min(player.current_hp, playerMaxHp);

        const initialPlayerHp = player.current_hp;
        const enemyDamageRng = seededRandom(`${userId}-${baseEnemy.id}-${zoneId}-dmg`);
        const enemy = {
            max_hp: enemyInstance.hp_max || enemyInstance.hp,
            current_hp: enemyInstance.hp_current || enemyInstance.hp,
            armor: enemyInstance.armor,
            damage_min: enemyInstance.damage_min,
            damage_max: enemyInstance.damage_max,
            crit_chance: enemyInstance.crit_chance || 0,
            block_chance: enemyInstance.block_chance || 0,
            is_elite_minor: enemyInstance.is_elite_minor,
            level: enemyInstance.level
        };
        const initialEnemyHp = enemy.max_hp;

        let log = [];
        let isWin = false;
        let totalDamageDealtByPlayer = 0;
        let totalDamageDealtByEnemy = 0;
        let battleEndedPrematurely = false; // Nueva bandera para saber si alguien murió antes

        // --- BUCLE DE COMBATE (10 RONDAS) ---
        for (let r = 1; r <= 10; r++) {
            log.push({ type: 'round', msg: `--- RONDA ${r} ---` });

            // 1. TURNO JUGADOR
            const weaponDmg = weaponMax > weaponMin ? Math.floor(Math.random() * (weaponMax - weaponMin + 1)) + weaponMin : weaponMin;
            const statDmg = Math.floor(Math.max(totalStr, totalDex) * 2);
            const baseTotalDmg = weaponDmg + statDmg;

            let skillTriggered = null;
            let skillDamage = 0;
            let skillHeal = 0;

            for (const skill of equippedSkills) {
                const chance = Math.min(60, (skill.trigger_chance || 15) + (totalInt * 0.5));
                if (Math.random() * 100 <= chance) {
                    skillTriggered = skill;
                    const lvlMult = 1 + ((skill.skill_level - 1) * 0.1);
                    if (skill.damage_min > 0) {
                        const baseSkillDmg = Math.floor(Math.random() * (skill.damage_max - skill.damage_min + 1)) + skill.damage_min;
                        skillDamage = Math.floor(baseSkillDmg * lvlMult);
                        if (skill.scaling_stat === 'intelligence') skillDamage += Math.floor(totalInt * (skill.scaling_factor || 1));
                        if (skill.scaling_stat === 'strength') skillDamage += Math.floor(totalStr * (skill.scaling_factor || 1));
                        if (skill.scaling_stat === 'dexterity') skillDamage += Math.floor(totalDex * (skill.scaling_factor || 1));
                    }
                    if (skill.heal_amount > 0) {
                        skillHeal = Math.floor(skill.heal_amount * lvlMult + (totalInt * 0.5));
                    }
                    break;
                }
            }

            let finalDmgToEnemy = Math.max(1, (baseTotalDmg + skillDamage) - Math.floor((enemy.armor || 0) / 5));
            enemy.current_hp -= finalDmgToEnemy;
            totalDamageDealtByPlayer += finalDmgToEnemy;

            if (skillTriggered) {
                log.push({ type: 'player_atk', msg: `¡Usas ${skillTriggered.name}! (Daño: ${finalDmgToEnemy})`, isSkill: true, damage: finalDmgToEnemy, enemyHp: Math.max(0, enemy.current_hp) });
                if (skillHeal > 0) {
                    player.current_hp = Math.min(playerMaxHp, player.current_hp + skillHeal);
                    log.push({ type: 'info', msg: `Te curas ${skillHeal} HP.` });
                }
            } else {
                log.push({ type: 'player_atk', msg: `Golpeas por ${finalDmgToEnemy}`, damage: finalDmgToEnemy, enemyHp: Math.max(0, enemy.current_hp) });
            }

            // CHECK VICTORIA (Enemigo muerto)
            if (enemy.current_hp <= 0) {
                isWin = true;
                battleEndedPrematurely = true;
                log.push({ type: 'info', msg: "¡Victoria! El enemigo ha caído." });
                break; // Rompe el bucle, ganaste
            }

            // 2. TURNO ENEMIGO
            const enemyAttack = randomInt(enemy.damage_min, enemy.damage_max, enemyDamageRng);
            let dmgToPlayer = Math.max(1, enemyAttack - Math.floor((totalArmor + totalCon / 2) / 5));
            player.current_hp -= dmgToPlayer;
            totalDamageDealtByEnemy += dmgToPlayer;

            log.push({ type: 'enemy_atk', msg: `Te golpean por ${dmgToPlayer}`, damage: dmgToPlayer, playerHp: Math.max(0, player.current_hp) });

            // CHECK DERROTA (Jugador muerto)
            if (player.current_hp <= 0) {
                isWin = false;
                battleEndedPrematurely = true;
                // NO RESETEAMOS HP AQUÍ TODAVÍA, para evitar que el desempate se confunda
                log.push({ type: 'info', msg: "Has sido derrotado." });
                break; // Rompe el bucle, perdiste
            }
        }

        // --- 3. LÓGICA DE DESEMPATE (Solo si nadie murió) ---
        if (!battleEndedPrematurely) {
            // Ambos siguen vivos tras 10 rondas -> Gana quien hizo más daño
            if (totalDamageDealtByPlayer >= totalDamageDealtByEnemy) {
                isWin = true;
                log.push({ type: 'info', msg: `¡Tiempo agotado! Victoria por daño (${totalDamageDealtByPlayer} vs ${totalDamageDealtByEnemy}).` });
            } else {
                isWin = false;
                log.push({ type: 'info', msg: `¡Tiempo agotado! Derrota por daño (${totalDamageDealtByPlayer} vs ${totalDamageDealtByEnemy}).` });
            }
        }

        // --- AHORA SÍ: SI PERDISTE, CURA MÍNIMA PARA DB ---
        if (player.current_hp <= 0) player.current_hp = 1; 

        // --- LOGICA DE PREMIOS (Mismo código de antes) ---
        let questLogs = [];
        let isNewBestiaryEntry = false;
        if (isWin) {
            const bestiaryBeforeRes = await client.query(
                'SELECT kills FROM player_bestiary WHERE player_id = $1 AND enemy_id = $2',
                [userId, baseEnemy.id]
            );
            isNewBestiaryEntry = bestiaryBeforeRes.rows.length === 0;

            await client.query(`INSERT INTO player_bestiary (player_id, enemy_id, kills, first_kill_at) VALUES ($1, $2, 1, NOW()) ON CONFLICT (player_id, enemy_id) DO UPDATE SET kills = player_bestiary.kills + 1`, [userId, baseEnemy.id]);
            const activeQuestsRes = await client.query(`SELECT pq.id, pq.progress, q.title, q.requirements FROM player_quests pq JOIN quests q ON pq.quest_id = q.id WHERE pq.player_id = $1 AND pq.status = 'active'`, [userId]);
            for (const quest of activeQuestsRes.rows) {
                let progress = { ...quest.progress };
                let updated = false;
                const requirements = quest.requirements || [];
                for (const req of requirements) {
                    if (req.type === 'kill') {
                        if (req.target_id) {
                            if (parseInt(req.target_id) === parseInt(baseEnemy.id)) {
                                const currentCount = parseInt(progress[req.target_id] || 0);
                                const targetCount = parseInt(req.count);
                                if (currentCount < targetCount) {
                                    progress[req.target_id] = currentCount + 1;
                                    updated = true;
                                    questLogs.push(`📜 ${quest.title}: ${req.name} (${progress[req.target_id]}/${targetCount})`);
                                }
                            }
                        } else {
                            const key = 'kill';
                            const currentCount = parseInt(progress[key] || 0);
                            const targetCount = parseInt(req.count);
                            if (currentCount < targetCount) {
                                progress[key] = currentCount + 1;
                                updated = true;
                                questLogs.push(`📜 ${quest.title}: Enemigos derrotados (${progress[key]}/${targetCount})`);
                            }
                        }
                    }
                }
                if (updated) await client.query("UPDATE player_quests SET progress = $1 WHERE id = $2", [JSON.stringify(progress), quest.id]);
            }
        }

        let rewards = { xp: 0, copper: 0, items: [] };
        let finalGold = parseInt(player.gold || 0);
        let finalSilver = parseInt(player.silver || 0);
        let finalCopper = parseInt(player.copper || 0);
        let currentXp = parseInt(player.experience || 0);
        let currentLevel = parseInt(player.level || 1);
        let currentStatPoints = parseInt(player.stat_points || 0);
        let leveledUp = false;
        let petXpResult = null;

        if (isWin) {
            const baseXp = baseEnemy.xp_reward ?? computeEnemyXp({ enemy: { ...baseEnemy, is_elite_minor: enemyInstance.is_elite_minor }, playerLevel: currentLevel, enemyLevel: enemyInstance.level });
            const xpGain = baseXp;
            rewards.xp = xpGain;
            currentXp += xpGain;

            while (true) {
                const xpNeeded = getRequiredXp(currentLevel);
                if (currentXp >= xpNeeded) {
                    currentXp -= xpNeeded;
                    currentLevel++;
                    currentStatPoints += 5;
                    leveledUp = true;
                    player.current_hp = playerMaxHp;
                    log.push({ type: 'info', msg: `¡LEVEL UP! Ahora eres nivel ${currentLevel}` });
                } else { break; }
            }

            const minGold = baseEnemy.gold_reward_min || 1;
            const maxGold = baseEnemy.gold_reward_max || 5;
            let copperGain = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold;
            if (enemyInstance.is_elite_minor) {
                copperGain = Math.round(copperGain * 1.15);
                if (Math.random() <= 0.02) copperGain += 100;
            }
            rewards.copper = copperGain;

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
                    await client.query(`INSERT INTO player_packages (player_id, item_template_id, quantity, data) VALUES ($1, $2, $3, $4)`, [userId, drop.item_template_id, qty, dropStats]);
                    rewards.items.push({ name: template.name, qty });
                }
            }

            const achievementMetadata = {
                source: 'expedition',
                enemyId: Number(baseEnemy.id),
                enemyName: baseEnemy.name,
                zoneId: Number(baseEnemy.zone_id || zoneId),
                isBoss: Boolean(baseEnemy.is_boss),
                isHidden: Boolean(baseEnemy.is_hidden),
                difficultyTier: Number(baseEnemy.difficulty_tier || 1)
            };

            await achievementService.incrementProgress(userId, 'combat.kill', 1, achievementMetadata, client);

            await achievementService.incrementProgress(userId, 'expedition.complete', 1, {
                source: 'expedition',
                zoneId: Number(baseEnemy.zone_id || zoneId)
            }, client);

            await achievementService.incrementProgress(userId, 'combat.kill.difficulty', 1, achievementMetadata, client);

            if (baseEnemy.is_boss) {
                await achievementService.incrementProgress(userId, 'combat.kill.boss', 1, achievementMetadata, client);
            }

            if (baseEnemy.is_hidden) {
                await achievementService.incrementProgress(userId, 'combat.kill.hidden', 1, achievementMetadata, client);
            }

            if (isNewBestiaryEntry) {
                await achievementService.incrementProgress(userId, 'bestiary.discover', 1, achievementMetadata, client);
            }

            if (rewards.copper > 0) {
                await achievementService.incrementProgress(userId, 'economy.copper_earned', rewards.copper, {
                    source: 'expedition',
                    zoneId: Number(baseEnemy.zone_id || zoneId)
                }, client);
            }

            const petExpGain = getPetExpGainFromEnemy(baseEnemy);
            const petHungerCost = getPetHungerCostFromEnemy(baseEnemy);
            petXpResult = await applyPetExperience(userId, petExpGain, client, petHungerCost);
            if (petXpResult?.leveledUp) {
                log.push({ type: 'info', msg: `¡Tu mascota subió a nivel ${petXpResult.newLevel}!` });
            }
        }

        await statisticsService.recordExpeditionBattle(userId, {
            isWin,
            enemy: baseEnemy,
            rewards,
            isNewBestiaryEntry
        }, client);

        const durabilityLoss = isWin ? 1 : 2;
        await client.query(`UPDATE player_items SET durability_current = GREATEST(0, durability_current - $1) WHERE player_id = $2 AND is_equipped = true`, [durabilityLoss, userId]);

        await client.query(`
            UPDATE players 
            SET current_hp = $1, energy = energy - 5, experience = $2, level = $3, stat_points = $4,
                gold = $5, silver = $6, copper = $7, last_expedition_at = NOW(), last_regen_at = $8 
            WHERE id = $9`,
            [player.current_hp, currentXp, currentLevel, currentStatPoints, finalGold, finalSilver, finalCopper, player.last_regen_at, userId]
        );

        await client.query('COMMIT');

        if (questLogs.length > 0) questLogs.forEach(msg => log.push({ type: 'info', msg: msg }));

        const enemyStatsResult = {
            level: enemy.level,
            hp_current: enemy.current_hp,
            hp_max: enemy.max_hp,
            damage_min: enemy.damage_min,
            damage_max: enemy.damage_max,
            armor: enemy.armor,
            crit_chance: enemy.crit_chance || 0,
            block_chance: enemy.block_chance || 0,
            is_elite_minor: enemy.is_elite_minor
        };

        res.json({
            success: true,
            combatResult: {
                isWin, log, rewards, leveledUp,
                initialPlayerHp, initialEnemyHp, finalPlayerHp: player.current_hp,
                enemyName: baseEnemy.name, enemyImage: baseEnemy.image_url,
                enemy_stats: enemyStatsResult,
                pet_result: petXpResult
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
