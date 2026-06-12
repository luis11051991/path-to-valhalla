const { db } = require('../config/db');

const PROF_XP_REQUIREMENTS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];
const VALID_PROFESSIONS = ['weaponsmith', 'armorsmith', 'scribe', 'jeweler', 'herbalist'];

const STARTER_RECIPES = { weaponsmith: [1], armorsmith: [2], herbalist: [3], scribe: [4], jeweler: [5] };
const STARTER_KITS = { weaponsmith: { materials: [{ id: 1, qty: 5 }] }, armorsmith: { materials: [{ id: 1, qty: 10 }] }, herbalist: { materials: [{ id: 2, qty: 10 }] }, scribe: { materials: [{ id: 3, qty: 5 }] }, jeweler: { materials: [{ id: 1, qty: 5 }] } };

const generateRandomStats = (template, rarityMultiplier = 1, rarityName = 'common') => {
    const finalStats = {};
    const templateStats = template.base_stats || {};
    for (const [key, value] of Object.entries(templateStats)) {
        if (Array.isArray(value) && value.length === 2) {
            let val = Math.floor(Math.random() * (value[1] - value[0] + 1)) + value[0];
            finalStats[key] = Math.floor(val * rarityMultiplier);
        } else if (typeof value === 'number') {
            finalStats[key] = Math.floor(value * rarityMultiplier);
        } else {
            finalStats[key] = value;
        }
    }
    const noDurabilityTypes = ['consumable', 'material', 'scroll', 'recipe'];
    if (noDurabilityTypes.includes(template.type) || rarityName === 'legendary') { finalStats.durability = null; }
    else { finalStats.durability = 100; }
    finalStats.rarityOverride = rarityName;
    return finalStats;
};

exports.getWorkshopData = async (req, res) => {
    const userId = req.user.id;

    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) return res.status(404).json({ message: 'Jugador no encontrado' });
        const level = playerDoc.data().level;

        // Obtener profesiones del jugador
        const myProfSnap = await db.collection('players').doc(userId).collection('professions').limit(1).get();
        
        let professionData = null;
        if (!myProfSnap.empty) {
            const profDoc = myProfSnap.docs[0];
            const tplDoc = await db.collection('professions').doc(String(profDoc.data().profession_id)).get();
            if (tplDoc.exists) {
                professionData = { ...profDoc.data(), id: profDoc.id, name: tplDoc.data().name, icon: tplDoc.data().icon };
            }
        }

        // Obtener recetas del catalogo si tiene profesion
        let allRecipes = [];
        if (professionData) {
            const recipesSnap = await db.collection('recipes').where('profession_id', '==', Number(professionData.profession_id)).get();
            allRecipes = recipesSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        }

        // Obtener profesiones disponibles
        const availableProfessionsSnap = await db.collection('professions').get();
        const availableProfessions = availableProfessionsSnap.docs.map(d => ({ ...d.data(), id: d.id }));

        res.json({ success: true, level, profession: professionData, recipes: allRecipes, availableProfessions });

    } catch (err) {
        console.error('Error workshop:', err);
        res.status(500).json({ message: 'Error cargando taller.' });
    }
};

exports.chooseProfession = async (req, res) => {
    const userId = req.user.id;
    const { profession } = req.body;

    if (!VALID_PROFESSIONS.includes(profession)) return res.status(400).json({ message: 'Profesion no valida.' });

    try {
        await db.runTransaction(async (t) => {
            const playerRef = db.collection('players').doc(userId);
            const playerDoc = await t.get(playerRef);
            
            if (playerDoc.data().level < 5) throw new Error('Necesitas ser Nivel 5.');

            // Verificar si ya tiene profesion
            const profSnap = await t.get(db.collection('players').doc(userId).collection('professions').limit(1));
            if (!profSnap.empty) throw new Error('Ya tienes una profesion.');

            const initialRecipes = STARTER_RECIPES[profession] || [];
            
            // Obtener profession_id desde el catalogo
            const profTplSnap = await t.get(db.collection('professions').where('name', '==', profession).limit(1));
            if (profTplSnap.empty) throw new Error('Profesion no encontrada.');
            const professionId = Number(profTplSnap.docs[0].id);

            // Guardar profesion
            t.create(db.collection('players').doc(userId).collection('professions'), {
                profession_id: professionId, level: 1, xp: 0, learned_recipes: initialRecipes, created_at: new Date(),
            });

            // Entregar materiales del kit
            const kit = STARTER_KITS[profession] || { materials: [] };
            for (const mat of kit.materials) {
                // Verificar si ya existe stack de este material
                const existingSnap = await t.get(
                    db.collection('players').doc(userId).collection('items')
                        .where('template_id', '==', Number(mat.id))
                        .limit(1)
                );
                
                if (!existingSnap.empty) {
                    t.update(existingSnap.docs[0].ref, { quantity: existingSnap.docs[0].data().quantity + mat.qty });
                } else {
                    // Buscar slot libre
                    const slotsSnap = await t.get(db.collection('players').doc(userId).collection('items')
                        .where('bag_slot', '!=', null));
                    const occupiedSlots = new Set(slotsSnap.docs.map(d => d.data().bag_slot));
                    let targetSlot = -1;
                    for (let i = 0; i < 40; i++) { if (!occupiedSlots.has(i)) { targetSlot = i; break; } }

                    if (targetSlot !== -1) {
                        t.create(db.collection('players').doc(userId).collection('items'), {
                            template_id: Number(mat.id), quantity: mat.qty, is_equipped: false, bag_slot: targetSlot,
                            durability_current: null, durability_max: null, is_bound: false, created_at: new Date(),
                        });
                    }
                }
            }
        });

        res.json({ success: true, message: 'Profesion elegida! Recibes el kit de inicio.' });

    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
};

exports.craftItem = async (req, res) => {
    const userId = req.user.id;
    const { recipeId, targetRarity } = req.body;

    try {
        const playerDoc = await db.collection('players').doc(userId).get();
        if (!playerDoc.exists) throw new Error('Jugador no encontrado');
        const level = playerDoc.data().level;
        
        if (level < 30) return res.status(400).json({ message: 'Necesitas ser nivel 30.' });

        // Obtener profession
        const profSnap = await db.collection('players').doc(userId).collection('professions').limit(1).get();
        if (profSnap.empty) throw new Error('No tienes profesion.');
        const myProfDoc = profSnap.docs[0];
        const myProf = { ...myProfDoc.data(), profession_id: myProfDoc.data().profession_id };

        // Obtener recipe del catalogo
        const recipeDoc = await db.collection('recipes').doc(String(recipeId)).get();
        if (!recipeDoc.exists) throw new Error('Receta no encontrada.');
        const recipe = recipeDoc.data();

        // Calcular costo
        const costCopper = recipe.cost_gold * 10000 + recipe.cost_silver * 100 + recipe.cost_copper;
        let totalCopper = (parseInt(playerDoc.data().gold) * 10000) + (parseInt(playerDoc.data().silver) * 100) + parseInt(playerDoc.data().copper);

        if (totalCopper < costCopper) throw new Error('Fondos insuficientes.');
        totalCopper -= costCopper;

        // Obtener rarity info
        let targetItemId = Number(recipe.result_item_template_id);
        const resultTplDoc = await db.collection('items_templates').doc(String(targetItemId)).get();
        if (!resultTplDoc.exists) throw new Error('Item template not found');
        
        let myProfLevel = myProf.level || 1;
        let rarityMultiplier = 1, rarityName = 'common';

        if (targetRarity) {
            if (targetRarity === 'uncommon') {
                if (myProfLevel < 10) throw new Error('Requiere Nivel 10 de oficio.');
                rarityMultiplier = 1.2; rarityName = 'uncommon';
            } else if (targetRarity === 'rare') {
                if (myProfLevel < 30) throw new Error('Requiere Nivel 30 de oficio.');
                rarityMultiplier = 1.5; rarityName = 'rare';
            } else if (targetRarity === 'legendary') {
                if (myProfLevel < 60) throw new Error('Requiere Nivel 60 de oficio.');
                rarityMultiplier = 2.0; rarityName = 'legendary';
            }
        }

        // Consumir materiales
        const materialsNeeded = recipe.materials || {};
        for (const [matId, qtyNeeded] of Object.entries(materialsNeeded)) {
            const matSnap = await db.collection('players').doc(userId).collection('items')
                .where('template_id', '==', Number(matId))
                .get();
            
            let totalAvailable = 0;
            for (const d of matSnap.docs) totalAvailable += d.data().quantity || 0;

            if (totalAvailable < qtyNeeded) throw new Error('Faltan materiales.');

            // Consumir materiales
            let remaining = qtyNeeded;
            const sortedDocs = [...matSnap.docs].sort((a, b) => a.data().quantity - b.data().quantity);
            
            for (const stackDoc of sortedDocs) {
                if (remaining <= 0) break;
                const take = Math.min(stackDoc.data().quantity, remaining);
                remaining -= take;
                
                if (take >= stackDoc.data().quantity) {
                    await db.collection('players').doc(userId).collection('items').doc(stackDoc.id).delete();
                } else {
                    await db.collection('players').doc(userId).collection('items').doc(stackDoc.id).update({ quantity: stackDoc.data().quantity - take });
                }
            }
        }

        await db.runTransaction(async (t) => {
            t.update(db.collection('players').doc(userId), {
                gold: Math.floor(totalCopper / 10000), silver: Math.floor((totalCopper % 10000) / 100), copper: totalCopper % 100,
            });

            // Actualizar XP de profesion
            let newXp = (myProf.xp || 0) + recipe.xp_reward;
            let newLevel = myProf.level || 1;
            const neededXp = PROF_XP_REQUIREMENTS[newLevel] || 99999;
            let leveledUp = false;

            while (newXp >= neededXp) {
                newXp -= neededXp;
                newLevel++;
                leveledUp = true;
            }

            t.update(db.collection('players').doc(userId).collection('professions').doc(myProfDoc.id), { xp: newXp, level: newLevel });
        });

        const successChance = Math.min(95, 70 + (myProfLevel * 2));
        const isSuccess = Math.random() * 100 <= successChance;

        if (isSuccess) {
            const finalStats = generateRandomStats(resultTplDoc.data(), rarityMultiplier, rarityName);
            
            await db.collection('players').doc(userId).collection('packages').add({
                item_template_id: targetItemId, quantity: recipe.result_quantity, data: finalStats, created_at: new Date(),
            });

            const msg = leveledUp ? 'Nivel Subido!' : 'Exito!';
            res.json({ success: true, message: msg, detail: 'Creado: ' + recipe.result_quantity + 'x ' + resultTplDoc.data().name, newLevel: myProfLevel + (leveledUp ? 0 : 1) });
        } else {
            res.json({ success: false, isCraftFail: true, message: 'Fallo Critico', detail: 'Materiales rotos.' });
        }

    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
};
