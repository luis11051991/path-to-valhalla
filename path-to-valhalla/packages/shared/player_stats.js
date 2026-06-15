const { db, decodeDoc } = require('../config/db');

// --- CONSTANTES DE REGENERACION ---
const HP_REGEN_AMOUNT = 1;
const HP_REGEN_EVERY_SECONDS = 3;
const ENERGY_REGEN_AMOUNT = 1;
const ENERGY_REGEN_EVERY_SECONDS = 120;
const VALOR_REGEN_AMOUNT = 1;
const VALOR_REGEN_EVERY_SECONDS = 1800;
const VALOR_MAX_DEFAULT = 5;
const HP_MAX_DEFAULT = 100;

const normalizeStats = (stats) => {
    if (!stats) return {};
    if (typeof stats === 'string') {
        try { return JSON.parse(stats); } catch (e) { return {}; }
    }
    return stats;
};

const addStats = (target, source) => {
    if (!source) return;
    Object.entries(source).forEach(([key, val]) => {
        const numeric = Array.isArray(val) ? Math.floor((Number(val[0]) + Number(val[1])) / 2) : Number(val);
        if (Number.isNaN(numeric)) return;
        target[key] = (target[key] || 0) + numeric;
    });
};

const computeTotalStats = ({ baseStats = {}, equippedItems = [], petBonuses = {} }) => {
    const total = { ...normalizeStats(baseStats) };
    equippedItems.forEach((statObj) => addStats(total, statObj || {}));
    addStats(total, petBonuses || {});
    return total;
};

const computeMaxHp = (totalConstitution = 0) => {
    const con = Number(totalConstitution) || 0;
    return 100 + (con * 20);
};

// Firestore compatible timestamp handling
const toDate = (val) => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    return new Date(val);
};

const applyRegen = ({ currentHp = 0, maxHp = 0, currentEnergy = 0, maxEnergy = 100, currentValor = 0, maxValor = 5, lastRegenAt, now = new Date() }) => {
    const last = toDate(lastRegenAt);
    const diffSeconds = Math.max(0, Math.floor((now - last) / 1000));

    const hpTicks = Math.floor(diffSeconds / HP_REGEN_EVERY_SECONDS);
    const energyTicks = Math.floor(diffSeconds / ENERGY_REGEN_EVERY_SECONDS);
    const valorTicks = Math.floor(diffSeconds / VALOR_REGEN_EVERY_SECONDS);

    let updatedHp = currentHp;
    if (hpTicks > 0 && currentHp < maxHp) { updatedHp = Math.min(maxHp, currentHp + (hpTicks * HP_REGEN_AMOUNT)); }

    let updatedEnergy = currentEnergy;
    if (energyTicks > 0 && currentEnergy < maxEnergy) { updatedEnergy = Math.min(maxEnergy, currentEnergy + (energyTicks * ENERGY_REGEN_AMOUNT)); }

    let updatedValor = currentValor;
    if (valorTicks > 0 && currentValor < maxValor) { updatedValor = Math.min(maxValor, currentValor + (valorTicks * VALOR_REGEN_AMOUNT)); }

    let updatedLast = last;
    if (hpTicks > 0) { updatedLast = new Date(last.getTime() + (hpTicks * HP_REGEN_EVERY_SECONDS * 1000)); }

    const isFull = updatedHp >= maxHp && updatedEnergy >= maxEnergy && updatedValor >= maxValor;
    if (isFull) { updatedLast = new Date(now); }

    return { currentHp: updatedHp, currentEnergy: updatedEnergy, currentValor: updatedValor, lastRegenAt: updatedLast };
};

const getEquippedStats = async (playerId) => {
    const res = await db.collection('players').doc(playerId).collection('items')
        .where('is_equipped', '==', true)
        .get();
    
    // Join con items_templates para obtener base_stats del template
    const statsPromises = [];
    for (const doc of res.docs) {
        const data = doc.data();
        if (data.base_stats && Object.keys(data.base_stats).length > 0) {
            statsPromises.push(Promise.resolve(normalizeStats(data.base_stats)));
        } else {
            // Fallback: obtener template
            const tplDoc = await db.collection('items_templates').doc(String(data.template_id)).get();
            if (tplDoc.exists && tplDoc.data().base_stats) {
                statsPromises.push(Promise.resolve(normalizeStats(tplDoc.data().base_stats)));
            } else {
                statsPromises.push(Promise.resolve({}));
            }
        }
    }
    
    // Si no items equipados con base_stats, intentar desde templates
    if (res.empty) return [];
    
    const results = await Promise.all(statsPromises);
    return results;
};

const getActivePetBonuses = async (playerId) => {
    const petSnap = await db.collection('players').doc(playerId).collection('pets')
        .where('is_active', '==', true)
        .limit(1)
        .get();
    
    if (petSnap.empty) return {};

    // Obtener bonus_stats desde el catalogo de pets
    const petData = petSnap.docs[0].data();
    const tplDoc = await db.collection('pets').doc(String(petData.pet_id)).get();
    if (!tplDoc.exists) return {};
    
    const bonusStats = tplDoc.data().bonus_stats;
    if (!bonusStats) return {};
    
    // Verificar hunger > 0 en Firestore
    const activePetSnap = await db.collection('players').doc(playerId).collection('pets')
        .where('is_active', '==', true)
        .where('current_hunger', '>', 0)
        .limit(1)
        .get();
    
    if (activePetSnap.empty) return {};
    
    return normalizeStats(bonusStats);
};

const hydratePlayer = async (userOrId, id) => {
    let basePlayer;

    if (userOrId && typeof userOrId === 'object' && !id) {
        // Si es un objeto con datos directos (como login), lo usamos directamente
        basePlayer = { ...userOrId };
    } else if (userOrId && id) {
        basePlayer = { ...userOrId };
        basePlayer.id = id;
    }

    const equippedStats = await getEquippedStats(basePlayer.id);
    const petBonuses = await getActivePetBonuses(basePlayer.id);

    // Parsear stats si es string
    let baseStatsRaw = basePlayer.stats;
    if (typeof baseStatsRaw === 'string') {
        try { baseStatsRaw = JSON.parse(baseStatsRaw); } catch (e) { baseStatsRaw = {}; }
    }

    const totalStats = computeTotalStats({
        baseStats: baseStatsRaw || {},
        equippedItems: equippedStats,
        petBonuses
    });

    const maxHp = computeMaxHp(totalStats.constitution || 0);

    let lastRegenAt = basePlayer.last_regen_at;
    if (lastRegenAt) lastRegenAt = toDate(lastRegenAt);

    const regenResult = applyRegen({
        currentHp: Number(basePlayer.current_hp) || 0,
        maxHp,
        currentEnergy: Number(basePlayer.energy) || 0,
        maxEnergy: 100,
        currentValor: Number(basePlayer.valor) || 0,
        maxValor: VALOR_MAX_DEFAULT,
        lastRegenAt,
        now: new Date()
    });

    let currentHp = regenResult.currentHp;
    let currentEnergy = regenResult.currentEnergy;
    let currentValor = regenResult.currentValor;

    if (currentHp > maxHp) currentHp = maxHp;

    // Si hay cambios, actualizar Firestore
    const lastPersisted = basePlayer.last_regen_at ? toDate(basePlayer.last_regen_at).getTime() : null;
    const lastComputed = regenResult.lastRegenAt.getTime();

    const needsUpdate = currentHp !== (basePlayer.current_hp || 0) || currentEnergy !== (basePlayer.energy || 0) || currentValor !== (basePlayer.valor || 0) || (lastComputed && lastComputed !== lastPersisted);

    if (needsUpdate) {
        await db.collection('players').doc(basePlayer.id).update({
            current_hp: currentHp, energy: currentEnergy, valor: currentValor, last_regen_at: regenResult.lastRegenAt,
        });
    }

    // Si stats es un string, devolverlo como objeto normalizado
    const finalStats = typeof basePlayer.stats === 'string' ? JSON.stringify(totalStats) : totalStats;

    return {
        ...basePlayer,
        last_regen_at: regenResult.lastRegenAt,
        current_hp: currentHp, energy: currentEnergy, valor: currentValor,
        calculatedMaxHp: maxHp, calculated_max_hp: maxHp, total_stats: totalStats,
        stats: baseStatsRaw || {},
    };
};

hydratePlayer.normalizeStats = normalizeStats;
hydratePlayer.computeTotalStats = computeTotalStats;
hydratePlayer.computeMaxHp = computeMaxHp;
hydratePlayer.applyRegen = applyRegen;

module.exports = { HP_REGEN_AMOUNT, HP_REGEN_EVERY_SECONDS, computeTotalStats, computeMaxHp, applyRegen, hydratePlayer };
