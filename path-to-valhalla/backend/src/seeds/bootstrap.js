const { db } = require('../config/db');
const {
  GAME_SEED_VERSION,
  backgrounds,
  classes,
  itemsTemplates,
  professions,
  recipes,
  skills,
  pets,
  expeditions,
  enemies,
  quests,
  raceStarters,
} = require('./initialData');

const ITEM_TYPES_WITHOUT_DURABILITY = new Set(['consumable', 'material', 'scroll', 'recipe']);

function randomizeTemplateStats(templateStats = {}) {
  const finalStats = {};
  for (const [key, value] of Object.entries(templateStats)) {
    if (Array.isArray(value) && value.length === 2) {
      const min = Number(value[0]) || 0;
      const max = Number(value[1]) || min;
      finalStats[key] = Math.floor(Math.random() * (max - min + 1)) + min;
      continue;
    }
    finalStats[key] = value;
  }
  return finalStats;
}

function resolveDurability(template = {}) {
  if (ITEM_TYPES_WITHOUT_DURABILITY.has(template.type) || template.rarity === 'legendary') {
    return { durability_current: null, durability_max: null };
  }
  return { durability_current: 100, durability_max: 100 };
}

async function createDocIfMissing(collectionName, data) {
  const ref = db.collection(collectionName).doc(String(data.id));
  const snap = await ref.get();
  if (snap.exists) return false;
  await ref.set(data);
  return true;
}

async function seedCollection(collectionName, docs) {
  let created = 0;
  for (const doc of docs) {
    if (await createDocIfMissing(collectionName, doc)) {
      created += 1;
    }
  }
  return created;
}

async function seedEnemiesWithDrops() {
  let created = 0;
  let createdDrops = 0;

  for (const enemy of enemies) {
    const { drops = [], ...enemyData } = enemy;
    const enemyRef = db.collection('enemies').doc(String(enemy.id));
    const enemySnap = await enemyRef.get();

    if (!enemySnap.exists) {
      await enemyRef.set(enemyData);
      created += 1;
    }

    for (const drop of drops) {
      const dropRef = enemyRef.collection('drops').doc(String(drop.item_template_id));
      const dropSnap = await dropRef.get();
      if (dropSnap.exists) continue;

      await dropRef.set({
        ...drop,
        created_at: new Date(),
      });
      createdDrops += 1;
    }
  }

  return { created, createdDrops };
}

async function ensureInitialGameData() {
  if (!db) {
    console.warn('[seed] Firestore no disponible. Se omite la carga inicial.');
    return;
  }

  const counters = {};
  counters.backgrounds = await seedCollection('backgrounds', backgrounds);
  counters.classes = await seedCollection('classes', classes);
  counters.items_templates = await seedCollection('items_templates', itemsTemplates);
  counters.professions = await seedCollection('professions', professions);
  counters.recipes = await seedCollection('recipes', recipes);
  counters.skills = await seedCollection('skills', skills);
  counters.pets = await seedCollection('pets', pets);
  counters.expeditions = await seedCollection('expeditions', expeditions);
  counters.quests = await seedCollection('quests', quests);
  counters.race_starters = await seedCollection('race_starters', raceStarters);

  const enemyCounters = await seedEnemiesWithDrops();
  counters.enemies = enemyCounters.created;
  counters.enemy_drops = enemyCounters.createdDrops;

  await db.collection('meta').doc('game_seed').set({
    version: GAME_SEED_VERSION,
    last_bootstrapped_at: new Date(),
  }, { merge: true });

  const totalCreated = Object.values(counters).reduce((sum, value) => sum + value, 0);
  if (totalCreated > 0) {
    console.log(`[seed] Datos base cargados. Documentos creados: ${totalCreated}.`);
    return;
  }

  console.log('[seed] Datos base verificados. No faltaban documentos.');
}

async function grantStarterKitForRace({ userId, race }) {
  if (!db || !userId || !race) {
    return { granted: false, reason: 'invalid-params' };
  }

  return db.runTransaction(async (transaction) => {
    const playerRef = db.collection('players').doc(String(userId));
    const playerSnap = await transaction.get(playerRef);

    if (!playerSnap.exists) {
      throw new Error('player_not_found');
    }

    const player = playerSnap.data();
    if (player.starter_kit_claimed) {
      return { granted: false, reason: 'already-claimed' };
    }

    const starterRef = db.collection('race_starters').doc(String(race));
    const starterSnap = await transaction.get(starterRef);
    if (!starterSnap.exists) {
      return { granted: false, reason: 'starter-missing' };
    }

    const inventoryRef = playerRef.collection('items');
    const packagesRef = playerRef.collection('packages');
    const inventorySnap = await transaction.get(inventoryRef.where('bag_slot', '!=', null));
    const occupiedSlots = new Set(
      inventorySnap.docs
        .map((doc) => doc.data().bag_slot)
        .filter((value) => value !== null && value !== undefined)
    );

    const findNextSlot = () => {
      for (let slot = 0; slot < 40; slot += 1) {
        if (!occupiedSlots.has(slot)) {
          occupiedSlots.add(slot);
          return slot;
        }
      }
      return null;
    };

    let grantedCount = 0;
    const starterData = starterSnap.data();
    for (const entry of starterData.items || []) {
      const templateRef = db.collection('items_templates').doc(String(entry.template_id));
      const templateSnap = await transaction.get(templateRef);
      if (!templateSnap.exists) continue;

      const template = templateSnap.data();
      const quantity = Math.max(1, Number(entry.quantity) || 1);
      const randomizedStats = ITEM_TYPES_WITHOUT_DURABILITY.has(template.type)
        ? {}
        : randomizeTemplateStats(template.base_stats);
      const durability = resolveDurability(template);
      const targetSlot = findNextSlot();

      if (targetSlot !== null) {
        transaction.create(inventoryRef.doc(), {
          template_id: Number(entry.template_id),
          bag_slot: targetSlot,
          quantity,
          base_stats: randomizedStats,
          is_equipped: false,
          is_bound: false,
          created_at: new Date(),
          ...durability,
        });
      } else {
        transaction.create(packagesRef.doc(), {
          item_template_id: Number(entry.template_id),
          quantity,
          data: randomizedStats,
          created_at: new Date(),
        });
      }

      grantedCount += 1;
    }

    transaction.update(playerRef, {
      starter_kit_claimed: true,
      starter_kit_race: race,
      starter_kit_claimed_at: new Date(),
    });

    return { granted: grantedCount > 0, grantedCount };
  });
}

module.exports = {
  ensureInitialGameData,
  grantStarterKitForRace,
  randomizeTemplateStats,
  resolveDurability,
};
