const { seededRandom, randomInt } = require('./enemy_generator');

const DIFFICULTY_MULTIPLIERS = {
    easy: 0.5,
    normal: 1.0,
    hard: 1.5,
    inferno: 2.0
};

const MAX_ROUNDS = 20;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const computeNpcStats = (level) => ({
    hp: 80 + level * 18,
    damage_min: Math.max(1, 3 + level * 2),
    damage_max: Math.max(1, 5 + level * 3),
    armor: Math.floor(1 + level * 0.8),
    crit: Math.min(10, 2 + Math.floor(level / 5)),
    block: Math.min(8, 1 + Math.floor(level / 6))
});

const generateEnemyForStage = (enemyRow, stageSeed, difficultyMult) => {
    const rng = seededRandom(stageSeed + '-' + enemyRow.id);
    const level = randomInt(Number(enemyRow.min_level) || 1, Number(enemyRow.max_level) || 1, rng);
    const scaledLevel = Math.floor(level * Math.sqrt(difficultyMult));

    const baseHp = 40 + 6 * Math.pow(scaledLevel, 2);
    const baseDmg = 4 + 1.2 * Math.pow(scaledLevel, 1.3);
    const baseArmor = 1 + scaledLevel * 0.6;

    const isBoss = !!enemyRow.is_boss;
    const isElite = !isBoss && rng() <= 0.15;

    const hpMult = isBoss ? 4 : isElite ? 1.6 : 1;
    const dmgMult = isBoss ? 1.8 : isElite ? 1.3 : 1;
    const armorMult = isBoss ? 2.5 : isElite ? 1.4 : 1;

    const hpMax = Math.round(baseHp * hpMult * (0.9 + 0.2 * rng()));
    const dmgMin = Math.round(baseDmg * dmgMult * 0.85);
    const dmgMax = Math.round(baseDmg * dmgMult * 1.15);
    const armor = Math.round(baseArmor * armorMult);

    return {
        enemy_template_id: enemyRow.id,
        name: enemyRow.name || 'Enemigo',
        level: scaledLevel,
        hp_max: hpMax,
        hp_current: hpMax,
        damage_min: Math.max(1, dmgMin),
        damage_max: Math.max(1, dmgMax),
        armor: Math.max(0, armor),
        crit_chance: Math.min(25, (enemyRow.crit_chance || 0) + Math.floor(scaledLevel / 8)),
        block_chance: Math.min(20, (enemyRow.block_chance || 0) + Math.floor(scaledLevel / 10)),
        is_boss: isBoss,
        is_elite: isElite,
        image_url: enemyRow.image_url || null
    };
};

const simulateStageCombat = (party, enemies, difficulty) => {
    const diffMult = DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
    const log = [];

    const partyState = party.map(m => ({
        run_member_id: m.id,
        id: m.player_id || m.id,
        name: m.name || (m.is_npc ? `NPC Nv.${m.npc_level}` : `Jugador ${m.player_id}`),
        isNpc: m.is_npc,
        level: m.is_npc ? (m.npc_level || 1) : m.level,
        hp: m.current_hp != null ? m.current_hp : (m.hp || 100),
        maxHp: m.max_hp || m.hp || 100,
        stats: m.stats || {},
        skills: m.skills || [],
        alive: true
    }));

    const enemyState = enemies.map(e => ({
        id: e.id,
        name: e.name,
        level: e.level,
        hp: e.hp_current,
        maxHp: e.hp_max,
        damage_min: Math.floor(e.damage_min * diffMult),
        damage_max: Math.floor(e.damage_max * diffMult),
        armor: Math.floor(e.armor * diffMult),
        crit_chance: e.crit_chance,
        block_chance: e.block_chance,
        is_boss: e.is_boss,
        is_elite: e.is_elite,
        alive: true
    }));

    const totalPartyPower = partyState.reduce((sum, m) => {
        const s = m.stats;
        return sum + (s.strength || 0) + (s.dexterity || 0) + (s.constitution || 0) + (s.intelligence || 0) + m.level * 5;
    }, 0);

    const totalEnemyPower = enemyState.reduce((sum, e) => {
        return sum + e.hp + (e.damage_min + e.damage_max) * 2 + e.armor * 3 + e.level * 5;
    }, 0);

    const powerRatio = totalPartyPower / Math.max(1, totalEnemyPower);

    let partyTotalDmg = 0;
    let enemyTotalDmg = 0;
    let isWin = false;

    log.push({ type: 'info', round: 0, message: `Poder del grupo: ${totalPartyPower} | Poder enemigo: ${totalEnemyPower} (ratio: ${powerRatio.toFixed(2)})` });

    for (let round = 1; round <= MAX_ROUNDS; round++) {
        log.push({ type: 'round', round, message: `--- Ronda ${round} ---` });

        const aliveParty = partyState.filter(m => m.alive);
        const aliveEnemies = enemyState.filter(e => e.alive);

        if (aliveParty.length === 0 || aliveEnemies.length === 0) break;

        for (const member of aliveParty) {
            const s = member.stats;
            const str = s.strength || 0;
            const dex = s.dexterity || 0;
            const intel = s.intelligence || 0;
            const con = s.constitution || 0;

            const weaponDmg = member.isNpc
                ? randomInt(member.stats.damage_min || 3, member.stats.damage_max || 8, `${member.id}-${round}`)
                : randomInt((s.damage_min || 1), (s.damage_max || 3), `${member.id}-${round}`);
            const statDmg = Math.floor(Math.max(str, dex) * 1.5);
            let baseAtk = Math.max(1, weaponDmg + statDmg);

            let skillDmg = 0;
            let skillHeal = 0;
            let skillName = null;

            for (const skill of (member.skills || [])) {
                const chance = Math.min(60, (skill.trigger_chance || 15) + (intel * 0.5));
                if (Math.random() * 100 <= chance) {
                    skillName = skill.name;
                    const lvlMult = 1 + ((skill.skill_level - 1) * 0.1);
                    if (skill.damage_min > 0) {
                        const baseSkillDmg = randomInt(skill.damage_min, skill.damage_max, `${member.id}-skill-${round}`);
                        skillDmg = Math.floor(baseSkillDmg * lvlMult + (intel * (skill.scaling_factor || 0.5)));
                    }
                    if (skill.heal_amount > 0) {
                        skillHeal = Math.floor(skill.heal_amount * lvlMult + (intel * 0.5));
                    }
                    break;
                }
            }

            const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
            const armorReduction = Math.floor(target.armor / 5);
            const dmgToEnemy = Math.max(1, baseAtk + skillDmg - armorReduction);

            target.hp -= dmgToEnemy;
            partyTotalDmg += dmgToEnemy;

            if (skillName) {
                log.push({ type: 'skill', round, message: `${member.name} usa ${skillName}! (${dmgToEnemy} daño a ${target.name})`, memberId: member.id, targetId: target.id, damage: dmgToEnemy, skillName });
            } else {
                log.push({ type: 'player_atk', round, message: `${member.name} golpea a ${target.name} por ${dmgToEnemy}`, memberId: member.id, targetId: target.id, damage: dmgToEnemy });
            }

            if (skillHeal > 0 && member.hp < member.maxHp) {
                const healed = Math.min(skillHeal, member.maxHp - member.hp);
                member.hp += healed;
                log.push({ type: 'heal', round, message: `${member.name} se cura ${healed} HP`, memberId: member.id, heal: healed });
            }

            if (target.hp <= 0) {
                target.alive = false;
                log.push({ type: 'enemy_death', round, message: `${target.name} ha sido derrotado!`, targetId: target.id });
            }
        }

        const stillAliveEnemies = enemyState.filter(e => e.alive);
        if (stillAliveEnemies.length === 0) {
            isWin = true;
            log.push({ type: 'victory', round, message: '¡Todos los enemigos han sido derrotados!' });
            break;
        }

        for (const enemy of stillAliveEnemies) {
            const alivePartyMembers = partyState.filter(m => m.alive);
            if (alivePartyMembers.length === 0) break;

            const eAtk = randomInt(enemy.damage_min, enemy.damage_max, `enemy-${enemy.id}-${round}`);
            const target = alivePartyMembers[Math.floor(Math.random() * alivePartyMembers.length)];

            const tCon = target.stats.constitution || 0;
            const tArmor = target.stats.armor || 0;
            const tDefense = target.stats.defense || 0;
            const reduction = Math.floor((tArmor + tDefense + Math.floor(tCon / 2)) / 5);
            const dmgToMember = Math.max(1, eAtk - reduction);

            target.hp -= dmgToMember;
            enemyTotalDmg += dmgToMember;

            log.push({ type: 'enemy_atk', round, message: `${enemy.name} golpea a ${target.name} por ${dmgToMember}`, memberId: target.id, sourceId: enemy.id, damage: dmgToMember });

            if (target.hp <= 0) {
                target.alive = false;
                log.push({ type: 'member_death', round, message: `${target.name} ha caído!`, memberId: target.id });
            }
        }

        const stillAliveParty = partyState.filter(m => m.alive);
        if (stillAliveParty.length === 0) {
            isWin = false;
            log.push({ type: 'defeat', round, message: '¡El grupo ha sido aniquilado!' });
            break;
        }
    }

    if (!log.some(l => l.type === 'victory' || l.type === 'defeat')) {
        if (partyTotalDmg >= enemyTotalDmg) {
            isWin = true;
            log.push({ type: 'victory', round: MAX_ROUNDS, message: `Tiempo agotado. Victoria por daño (${partyTotalDmg} vs ${enemyTotalDmg}).` });
        } else {
            isWin = false;
            log.push({ type: 'defeat', round: MAX_ROUNDS, message: `Tiempo agotado. Derrota por daño (${partyTotalDmg} vs ${enemyTotalDmg}).` });
        }
    }

    return {
        isWin,
        partyState: partyState.map(m => ({ run_member_id: m.run_member_id, id: m.id, hp: m.hp, maxHp: m.maxHp, alive: m.alive })),
        enemyState: enemyState.map(e => ({ id: e.id, name: e.name, hp: Math.max(0, e.hp), maxHp: e.maxHp, alive: e.alive, is_boss: e.is_boss, is_elite: e.is_elite })),
        log,
        totalDamageDealt: partyTotalDmg,
        totalDamageTaken: enemyTotalDmg,
        powerRatio
    };
};

module.exports = { simulateStageCombat, generateEnemyForStage, DIFFICULTY_MULTIPLIERS, computeNpcStats, MAX_ROUNDS };
