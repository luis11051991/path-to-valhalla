const { db } = require('../config/db');
const { normalizeCurrency } = require('../utils/currencyUtils');
const { hydratePlayer, computeMaxHp } = require('../shared/player_stats');
const { getRequiredXp } = require('../shared/level_xp');
const { computeEnemyXp, computeEnemyLevel } = require('../shared/xp_rewards');
const { generateEnemyInstance, randomInt, seededRandom } = require('../shared/enemy_generator');

exports.getBestiary = async (req, res) => {
    const userId = req.user?.id;
    try {
        const enemiesSnap = await db.collection('enemies').orderBy('min_level', 'asc').orderBy('difficulty_tier', 'asc').get();
        const processedBestiary = [];

        for (const enemyDoc of enemiesSnap.docs) {
            const enemy = { ...enemyDoc.data(), id: enemyDoc.id };
            
            let kills = 0;
            let firstKillAt = null;
            if (userId) {
                const pbSnap = await db.collection('players').doc(userId).collection('bestiary')
                    .where('enemy_id', '==', Number(enemy.id))
                    .limit(1)
                    .get();
                if (!pbSnap.empty) {
                    kills = pbDoc.data().kills || 0;
                    firstKillAt = pbSnap.docs[0].data().first_kill_at;
                }
            }

            const weakSim = generateEnemyInstance({ ...enemy, min_level: enemy.min_level, max_level: enemy.min_level }, 'sim-weak', 'bestiary');
            const strongSim = generateEnemyInstance({ ...enemy, min_level: enemy.max_level, max_level: enemy.max_level }, 'sim-strong', 'bestiary');

            // Drops
            const dropsSnap = await db.collection('enemies').doc(String(enemy.id)).collection('drops').get();
            const drops = [];
            for (const dropDoc of dropsSnap.docs) {
                const itemTplDoc = await db.collection('items_templates').doc(String(dropDoc.data().item_template_id)).get();
                if (itemTplDoc.exists) {
                    drops.push({ name: itemTplDoc.data().name, rarity: itemTplDoc.data().rarity, chance: dropDoc.data().drop_chance, image_url: itemTplDoc.data().image_url });
                }
            }

            processedBestiary.push({
                ...enemy,
                kills,
                first_kill_at: firstKillAt,
                calculated_stats: {
                    damage: weakSim.damage_min + ' - ' + strongSim.damage_max,
                    hp: weakSim.hp_max + ' - ' + strongSim.hp_max,
                    armor: weakSim.armor + ' - ' + strongSim.armor,
                    crit: (weakSim.crit_chance || 0) + '%',
                    block: (weakSim.block_chance || 0) + '%',
                },
                drops,
            });
        }

        res.json({ success: true, bestiary: processedBestiary });
    } catch (err) {
        console.error('[BESTIARY ERROR]', err.message);
        res.status(500).json({ message: 'Error cargando el bestiario.' });
    }
};

exports.getExpeditions = async (req, res) => {
    try {
        const expeditionsSnap = await db.collection('expeditions').orderBy('level_required', 'asc').get();
        res.json({ success: true, expeditions: expeditionsSnap.docs.map(d => ({ ...d.data(), id: d.id })) });
    } catch (err) {
        res.status(500).json({ message: 'Error cargando mapa.' });
    }
};

exports.getZoneEnemies = async (req, res) => {
    const { zoneId } = req.params;
    const userId = req.user?.id;

    try {
        // Obtener quests activas para saber enemigos ocultos visibles
        let visibleHiddenIds = [];
        if (userId) {
            const pqSnap = await db.collection('players').doc(userId).collection('quests')
                .where('status', '==', 'active')
                .get();
            
            for (const pqDoc of pqSnap.docs) {
                const pqData = pqDoc.data();
                const requirements = pqData.requirements || [];
                const progress = pqData.progress || {};
                
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
        }

        let enemiesQuery = db.collection('enemies').where('zone_id', '==', Number(zoneId)).orderBy('difficulty_tier', 'asc').orderBy('min_level', 'asc');
        
        // Si hay enemigos ocultos visibles, incluirlos
        if (visibleHiddenIds.length > 0) {
            const regularSnap = await db.collection('enemies')
                .where('zone_id', '==', Number(zoneId))
                .where('is_hidden', '==', false)
                .get();
            
            const hiddenSnap = await db.collection('enemies')
                .where('zone_id', '==', Number(zoneId))
                .where('id', 'in', visibleHiddenIds.map(i => Number(i)))
                .get();

            const allEnemies = [...regularSnap.docs, ...hiddenSnap.docs];
            
            const enemies = allEnemies.map(d => {
                const e = d.data();
                return { ...e, computed_xp_reward: computeEnemyXp({ enemy: e, playerLevel: computeEnemyLevel(e), enemyLevel: computeEnemyLevel(e) }) };
            });

            return res.json({ success: true, enemies });
        }

        const enemiesSnap = await enemiesQuery.get();
        const enemies = enemiesSnap.docs.map(d => {
            const e = d.data();
            return { ...e, computed_xp_reward: computeEnemyXp({ enemy: e, playerLevel: computeEnemyLevel(e), enemyLevel: computeEnemyLevel(e) }) };
        });

        res.json({ success: true, enemies });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error obteniendo enemigos.' });
    }
};

exports.startBattle = async (req, res) => {
    const userId = req.user.id;
    const { enemyId, zoneId } = req.body || {};

    try {
        let isWin, log = [], questLogs = [];
        const initialPlayerHp = 100; // TODO: obtener del jugador real
        const baseEnemy = { name: 'Goblin', image_url: '', damage_min: 5, damage_max: 12, hp_max: 80, max_hp: 80, armor: 3, xp_reward: 10 };

        const enemyInstance = generateEnemyInstance(baseEnemy, enemyId, 'expedition');
        let currentEnemyHp = baseEnemy.hp_max;
        
        let playerHp = initialPlayerHp;
        
        // Simular combate simplificado
        let turn = 0;
        while (playerHp > 0 && currentEnemyHp > 0 && turn < 50) {
            turn++;
            
            // Turno jugador
            const playerDmg = Math.max(1, (Math.floor(Math.random() * (baseEnemy.damage_max - baseEnemy.damage_min + 1)) + baseEnemy.damage_min) - enemyInstance.armor);
            currentEnemyHp -= playerDmg;

            if (currentEnemyHp <= 0) {
                log.push({ type: 'info', msg: 'Has derrotado al enemigo!' });
                isWin = true;
                break;
            }

            // Turno enemigo
            const enemyDmg = Math.max(0, Math.floor(Math.random() * (baseEnemy.damage_max - baseEnemy.damage_min + 1)) + baseEnemy.damage_min - playerHp);
            playerHp -= enemyDmg;

            if (playerHp <= 0) {
                log.push({ type: 'info', msg: 'Has sido derrotado...' });
                isWin = false;
            } else {
                log.push({ type: 'info', msg: 'Turno ' + turn + ': Jugador ataca. HP enemigo: ' + currentEnemyHp });
            }
        }

        // Recompensas
        let rewards = { xp: 0, copper: 0, items: [] };
        
        if (isWin) {
            const baseXp = computeEnemyXp({ enemy: { ...baseEnemy, is_elite_minor: enemyInstance.is_elite_minor }, playerLevel: 1, enemyLevel: enemyInstance.level });
            rewards.xp = baseXp;

            let copperGain = Math.floor(Math.random() * 5) + 1;
            if (enemyInstance.is_elite_minor) {
                copperGain = Math.round(copperGain * 1.15);
                if (Math.random() <= 0.02) copperGain += 100;
            }
            rewards.copper = copperGain;

            const enemyDropsSnap = await db.collection('enemies').doc(String(enemyId)).collection('drops').get();
            for (const dropDoc of enemyDropsSnap.docs) {
                const dropData = dropDoc.data();
                if (Math.random() * 100 <= dropData.drop_chance) {
                    rewards.items.push({ name: 'Item dropeado', qty: 1 });
                }
            }
        }

        res.json({
            success: true,
            combatResult: {
                isWin, log, rewards, leveledUp: false,
                initialPlayerHp, initialEnemyHp: baseEnemy.hp_max, finalPlayerHp: playerHp,
                enemyName: baseEnemy.name, enemyImage: baseEnemy.image_url,
                enemy_stats: { level: enemyInstance.level, hp_current: currentEnemyHp, hp_max: baseEnemy.hp_max, damage_min: baseEnemy.damage_min, damage_max: baseEnemy.damage_max, armor: enemyInstance.armor, crit_chance: enemyInstance.crit_chance || 0 },
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};
