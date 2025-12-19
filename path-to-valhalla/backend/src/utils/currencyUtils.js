/**
 * Normaliza las monedas para respetar la regla 99+1.
 * @param {number|string} gold - Oro actual
 * @param {number|string} silver - Plata actual
 * @param {number|string} copper - Cobre actual
 * @param {number} copperToAdd - Cobre a añadir (puede ser 0)
 * @returns {Object} { newGold, newSilver, newCopper }
 */
const normalizeCurrency = (gold, silver, copper, copperToAdd = 0) => {
    // 1. Convertimos TODO a cobre absoluto
    // ParseInt asegura que no sumemos cadenas de texto por error
    let totalCopper = (parseInt(gold || 0) * 10000) + (parseInt(silver || 0) * 100) + parseInt(copper || 0) + parseInt(copperToAdd);

    // 2. Recalculamos usando división y resto
    const newGold = Math.floor(totalCopper / 10000); // Cada 10,000 cobres es 1 oro
    const remainder = totalCopper % 10000;
    
    const newSilver = Math.floor(remainder / 100); // De lo que sobra, cada 100 es 1 plata
    const newCopper = remainder % 100; // Lo que sobra es cobre suelto

    return { 
        newGold, 
        newSilver, 
        newCopper 
    };
};

module.exports = { normalizeCurrency };