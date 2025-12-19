const pool = require('../config/db');
const { normalizeCurrency } = require('./currencyUtils'); // <--- IMPORTANTE

/**
 * Calcula y aplica la regeneración pasiva de recursos (HP, Energía, Valor)
 * Y normaliza la moneda si está desajustada.
 * @param {Object} player - Objeto del jugador obtenido de la DB
 * @returns {Object} - El jugador con los valores actualizados
 */
const processRegeneration = async (player) => {
    // Si no hay fecha de última regeneración, asumimos que es ahora
    const now = new Date();
    const lastRegen = player.last_regen_at ? new Date(player.last_regen_at) : new Date();
    
    // Calculamos segundos transcurridos desde la última vez
    const diffSeconds = Math.floor((now - lastRegen) / 1000);
    
    // Si han pasado menos de 5 segundos, no hacemos cálculos de tiempo
    // PERO podríamos querer normalizar moneda. Para eficiencia, retornamos si es muy pronto.
    if (diffSeconds < 5) return player;

    // --- CONFIGURACIÓN DE TASAS ---
    const HP_REGEN_TIME = 10;      
    const ENERGY_REGEN_TIME = 120; 
    const VALOR_REGEN_TIME = 1800; 

    // --- CÁLCULOS DE VIDA (HP) ---
    const con = (player.stats && player.stats.constitution) ? player.stats.constitution : 10;
    const maxHp = 100 + (con * 20); 
    const hpHealed = Math.floor(diffSeconds / HP_REGEN_TIME);
    
    let newHp = player.current_hp;
    if (hpHealed > 0 && player.current_hp < maxHp) {
        newHp = Math.min(player.current_hp + hpHealed, maxHp);
    }

    // --- CÁLCULOS DE ENERGÍA ---
    const maxEnergy = player.max_energy || 100;
    const energyGained = Math.floor(diffSeconds / ENERGY_REGEN_TIME);
    
    let newEnergy = player.energy;
    if (energyGained > 0 && player.energy < maxEnergy) {
        newEnergy = Math.min(player.energy + energyGained, maxEnergy);
    }

    // --- CÁLCULOS DE VALOR ---
    const maxValor = player.max_valor || 5;
    const valorGained = Math.floor(diffSeconds / VALOR_REGEN_TIME);
    
    let newValor = player.valor;
    if (valorGained > 0 && player.valor < maxValor) {
        newValor = Math.min(player.valor + valorGained, maxValor);
    }

    // --- NORMALIZACIÓN DE MONEDA (99+1) ---
    // Verificamos si sus monedas están "sucias" (ej: tiene 150 cobre en la DB)
    const { newGold, newSilver, newCopper } = normalizeCurrency(player.gold, player.silver, player.copper);

    // Detectamos si hubo cambios
    const currencyChanged = (newGold !== parseInt(player.gold) || newSilver !== parseInt(player.silver) || newCopper !== parseInt(player.copper));
    const statsChanged = (newHp !== player.current_hp || newEnergy !== player.energy || newValor !== player.valor);

    // --- ACTUALIZACIÓN EN BASE DE DATOS ---
    if (statsChanged || currencyChanged) {
        
        await pool.query(`
            UPDATE players 
            SET current_hp = $1, energy = $2, valor = $3, 
                gold = $4, silver = $5, copper = $6,
                last_regen_at = NOW() 
            WHERE id = $7
        `, [newHp, newEnergy, newValor, newGold, newSilver, newCopper, player.id]);

        // Actualizamos el objeto en memoria
        player.current_hp = newHp;
        player.energy = newEnergy;
        player.valor = newValor;
        player.gold = newGold;
        player.silver = newSilver;
        player.copper = newCopper;
        player.last_regen_at = now;
        
        if (statsChanged) console.log(`[Regen] ${player.username} regenerado.`);
        if (currencyChanged) console.log(`[Economy] ${player.username} moneda normalizada.`);
    }

    return player;
};

module.exports = { processRegeneration };