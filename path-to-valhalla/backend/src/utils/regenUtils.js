const pool = require('../config/db');
const { normalizeCurrency } = require('./currencyUtils');

// Suma los stats de una lista de objetos { key: value }
const sumStats = (statsArray) => {
    return statsArray.reduce((acc, statObj) => {
        if (!statObj) return acc;
        Object.entries(statObj).forEach(([k, v]) => {
            acc[k] = (acc[k] || 0) + (Array.isArray(v) ? Math.floor((v[0] + v[1]) / 2) : v);
        });
        return acc;
    }, {});
};

const getEquippedBonuses = async (playerId) => {
    const res = await pool.query(
        `SELECT COALESCE(pi.base_stats, it.base_stats) AS stats 
         FROM player_items pi 
         JOIN items_templates it ON pi.template_id = it.id 
         WHERE pi.player_id = $1 AND pi.is_equipped = true`,
        [playerId]
    );
    return sumStats(res.rows.map((r) => r.stats || {}));
};

const getActivePetBonuses = async (playerId) => {
    const res = await pool.query(
        `SELECT p.bonus_stats 
         FROM player_pets pp 
         JOIN pets p ON pp.pet_id = p.id 
         WHERE pp.player_id = $1 AND pp.is_active = true AND pp.current_hunger > 0 
         LIMIT 1`,
        [playerId]
    );
    return res.rows.length ? res.rows[0].bonus_stats || {} : {};
};

/**
 * Calcula y aplica la regeneración pasiva de recursos (HP, Energía, Valor)
 * y normaliza monedas.
 */
const processRegeneration = async (player) => {
    const now = new Date();
    const lastRegen = player.last_regen_at ? new Date(player.last_regen_at) : new Date();
    const diffSeconds = Math.floor((now - lastRegen) / 1000);
    if (diffSeconds < 5) {
        player.calculated_max_hp = player.calculated_max_hp || (100 + ((player.stats?.constitution || 10) * 20));
        return player;
    }

    const HP_REGEN_TIME = 10;
    const ENERGY_REGEN_TIME = 120;
    const VALOR_REGEN_TIME = 1800;

    // Max HP con bonus de items y mascota
    const baseCon = player.stats?.constitution || 10;
    const itemBonuses = await getEquippedBonuses(player.id);
    const petBonuses = await getActivePetBonuses(player.id);
    const totalCon = baseCon + (itemBonuses.constitution || 0) + (petBonuses.constitution || 0);
    const maxHp = 100 + totalCon * 20;

    const hpHealed = Math.floor(diffSeconds / HP_REGEN_TIME);
    let newHp = Math.min(player.current_hp, maxHp);
    if (hpHealed > 0 && newHp < maxHp) {
        newHp = Math.min(newHp + hpHealed, maxHp);
    }

    // Energía
    const maxEnergy = player.max_energy || 100;
    const energyGained = Math.floor(diffSeconds / ENERGY_REGEN_TIME);
    let newEnergy = player.energy;
    if (energyGained > 0 && player.energy < maxEnergy) {
        newEnergy = Math.min(player.energy + energyGained, maxEnergy);
    }

    // Valor
    const maxValor = player.max_valor || 5;
    const valorGained = Math.floor(diffSeconds / VALOR_REGEN_TIME);
    let newValor = player.valor;
    if (valorGained > 0 && player.valor < maxValor) {
        newValor = Math.min(player.valor + valorGained, maxValor);
    }

    // Moneda
    const { newGold, newSilver, newCopper } = normalizeCurrency(player.gold, player.silver, player.copper);

    const currencyChanged =
        newGold !== parseInt(player.gold) || newSilver !== parseInt(player.silver) || newCopper !== parseInt(player.copper);
    const statsChanged = newHp !== player.current_hp || newEnergy !== player.energy || newValor !== player.valor;

    if (statsChanged || currencyChanged) {
        await pool.query(
            `
            UPDATE players 
            SET current_hp = $1, energy = $2, valor = $3, 
                gold = $4, silver = $5, copper = $6,
                last_regen_at = NOW() 
            WHERE id = $7
        `,
            [newHp, newEnergy, newValor, newGold, newSilver, newCopper, player.id]
        );

        player.current_hp = newHp;
        player.energy = newEnergy;
        player.valor = newValor;
        player.gold = newGold;
        player.silver = newSilver;
        player.copper = newCopper;
        player.last_regen_at = now;
    } else {
        player.last_regen_at = now;
    }

    player.calculated_max_hp = maxHp;
    return player;
};

module.exports = { processRegeneration };
