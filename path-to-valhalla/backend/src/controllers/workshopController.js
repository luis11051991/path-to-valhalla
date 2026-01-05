const pool = require('../config/db');

const PROF_XP_REQUIREMENTS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];
const VALID_PROFESSIONS = ['weaponsmith', 'armorsmith', 'scribe', 'jeweler', 'herbalist'];

// Configuración de Inicio
const STARTER_RECIPES = {
    weaponsmith: [1], armorsmith: [2], herbalist: [3], scribe: [4], jeweler: [5]
};
const STARTER_KITS = {
    weaponsmith: { materials: [{ id: 1, qty: 5 }] }, 
    armorsmith:  { materials: [{ id: 1, qty: 10 }] }, 
    herbalist:   { materials: [{ id: 2, qty: 10 }] }, 
    scribe:      { materials: [{ id: 3, qty: 5 }] },  
    jeweler:     { materials: [{ id: 1, qty: 5 }] }   
};

// --- HELPER: SISTEMA ECONÓMICO ---
const calculateNewBalance = (g, s, c, cost) => {
    let totalCopper = (g * 10000) + (s * 100) + c;
    if (totalCopper < cost) return null; 
    
    totalCopper -= cost;
    
    const newGold = Math.floor(totalCopper / 10000);
    totalCopper %= 10000;
    const newSilver = Math.floor(totalCopper / 100);
    const newCopper = totalCopper % 100;
    
    return { newGold, newSilver, newCopper };
};

// --- HELPER: STATS Y DURABILIDAD ---
const generateRandomStats = (template, rarityMultiplier = 1, rarityName = 'common') => {
    const finalStats = {};
    const templateStats = template.base_stats || {};

    for (const [key, value] of Object.entries(templateStats)) {
        if (Array.isArray(value) && value.length === 2) {
            let val = Math.floor(Math.random() * (value[1] - value[0] + 1)) + value[0];
            val = Math.floor(val * rarityMultiplier);
            finalStats[key] = val;
        } else if (typeof value === 'number') {
            finalStats[key] = Math.floor(value * rarityMultiplier);
        } else {
            finalStats[key] = value;
        }
    }

    // Durabilidad NULL para consumibles/materiales/BiS
    const noDurabilityTypes = ['consumable', 'material', 'scroll', 'recipe'];
    const isBiS = rarityName === 'legendary'; 

    if (noDurabilityTypes.includes(template.type) || isBiS) {
        finalStats.durability = null; 
    } else {
        finalStats.durability = 100;
    }

    finalStats.rarityOverride = rarityName;
    return finalStats;
};

// 1. ELEGIR PROFESIÓN (CON ASIGNACIÓN DE SLOT)
exports.chooseProfession = async (req, res) => {
    const userId = req.user.id;
    const { profession } = req.body;

    if (!VALID_PROFESSIONS.includes(profession)) return res.status(400).json({ message: "Profesión no válida." });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const playerRes = await client.query('SELECT level FROM players WHERE id = $1', [userId]);
        if (playerRes.rows[0].level < 5) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Necesitas ser Nivel 5." });
        }
        const checkProf = await client.query('SELECT * FROM player_professions WHERE player_id = $1', [userId]);
        if (checkProf.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Ya tienes una profesión." });
        }

        const initialRecipes = STARTER_RECIPES[profession] || [];
        const kit = STARTER_KITS[profession] || { materials: [] };

        await client.query(`
            INSERT INTO player_professions (player_id, profession_id, level, xp, learned_recipes)
            VALUES ($1, $2, 1, 0, $3)
        `, [userId, profession, JSON.stringify(initialRecipes)]);

        // Entregar Materiales (Buscando Slot Libre)
        for (const mat of kit.materials) {
            // 1. Intentar sumar a stack existente
            const updateRes = await client.query(`
                UPDATE player_items SET quantity = quantity + $1 
                WHERE player_id = $2 AND template_id = $3 AND bag_slot IS NOT NULL
            `, [mat.qty, userId, mat.id]);

            // 2. Si no existe, insertar en nuevo slot
            if (updateRes.rowCount === 0) {
                // Buscar primer slot libre (0-39)
                const slotsRes = await client.query('SELECT bag_slot FROM player_items WHERE player_id = $1 AND bag_slot IS NOT NULL', [userId]);
                const occupied = slotsRes.rows.map(r => r.bag_slot);
                let targetSlot = -1;
                for (let i = 0; i < 40; i++) {
                    if (!occupied.includes(i)) { targetSlot = i; break; }
                }

                if (targetSlot !== -1) {
                    await client.query(`
                        INSERT INTO player_items (player_id, template_id, quantity, is_equipped, bag_slot, durability_current, durability_max)
                        VALUES ($1, $2, $3, false, $4, NULL, NULL)
                    `, [userId, mat.id, mat.qty, targetSlot]);
                }
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `¡Profesión aprendida! Materiales en tu bolsa.`, profession });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: "Error al elegir profesión." });
    } finally {
        client.release();
    }
};

// 2. OBTENER DATOS
exports.getWorkshopData = async (req, res) => {
    const userId = req.user.id;
    try {
        const profRes = await pool.query('SELECT * FROM player_professions WHERE player_id = $1', [userId]);
        if (profRes.rows.length === 0) return res.json({ success: true, hasProfession: false });

        const myProf = profRes.rows[0];
        const recipeIds = myProf.learned_recipes || [];
        
        let recipes = [];
        let allMaterialIds = new Set();

        if (recipeIds.length > 0) {
            const recipesRes = await pool.query(`
                SELECT r.*, it.name as result_name, it.image_url as result_image, it.rarity, it.type, it.base_stats, it.description as item_desc
                FROM recipes r
                JOIN items_templates it ON r.result_item_template_id = it.id
                WHERE r.id = ANY($1::int[])
            `, [recipeIds]);
            recipes = recipesRes.rows;
            recipes.forEach(r => {
                if (r.materials) Object.keys(r.materials).forEach(id => allMaterialIds.add(parseInt(id)));
            });
        }

        const materialsInfo = {};
        if (allMaterialIds.size > 0) {
            const matInfoRes = await pool.query(`SELECT id, name, image_url, rarity FROM items_templates WHERE id = ANY($1::int[])`, [Array.from(allMaterialIds)]);
            matInfoRes.rows.forEach(row => { materialsInfo[row.id] = row; });
        }

        const inventoryRes = await pool.query(`SELECT template_id as id, quantity FROM player_items WHERE player_id = $1`, [userId]);
        const myInventory = {};
        inventoryRes.rows.forEach(row => { 
            // Sumar cantidades si hay múltiples stacks
            myInventory[row.id] = (myInventory[row.id] || 0) + row.quantity; 
        });

        res.json({ 
            success: true, 
            hasProfession: true, 
            profession: myProf.profession_id,
            level: myProf.level,
            xp: myProf.xp,
            nextLevelXp: PROF_XP_REQUIREMENTS[myProf.level] || 99999,
            recipes,
            inventory: myInventory,       
            materials_info: materialsInfo 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error cargando taller." });
    }
};

// 3. CRAFTEAR
exports.craftItem = async (req, res) => {
    const userId = req.user.id;
    const { recipeId, targetRarity } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Validaciones
        const recipeRes = await client.query('SELECT * FROM recipes WHERE id = $1', [recipeId]);
        if (recipeRes.rows.length === 0) throw new Error("Receta no encontrada.");
        const recipe = recipeRes.rows[0];

        const playerRes = await client.query('SELECT gold, silver, copper FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];
        const profRes = await client.query('SELECT * FROM player_professions WHERE player_id = $1', [userId]);
        const myProf = profRes.rows[0];

        if (recipe.profession && recipe.profession !== myProf.profession_id) {
            throw new Error(`Esta receta es para ${recipe.profession}, tú eres ${myProf.profession_id}.`);
        }

        // Validación Costo
        const newBalance = calculateNewBalance(
            parseInt(player.gold || 0), 
            parseInt(player.silver || 0), 
            parseInt(player.copper || 0), 
            recipe.cost_gold
        );
        if (!newBalance) throw new Error("Fondos insuficientes.");

        // Validación Rareza
        let rarityMultiplier = 1;
        let rarityName = 'common';
        
        if (targetRarity) {
            if (targetRarity === 'uncommon') {
                if (myProf.level < 10) throw new Error("Requiere Nivel 10 de oficio.");
                rarityMultiplier = 1.2; rarityName = 'uncommon';
            } else if (targetRarity === 'rare') {
                if (myProf.level < 30) throw new Error("Requiere Nivel 30 de oficio.");
                rarityMultiplier = 1.5; rarityName = 'rare';
            } else if (targetRarity === 'legendary') {
                if (myProf.level < 60) throw new Error("Requiere Nivel 60 de oficio.");
                rarityMultiplier = 2.0; rarityName = 'legendary';
            }
        }

        // Consumir Materiales
        const materialsNeeded = recipe.materials || {}; 
        for (const [matId, qtyNeeded] of Object.entries(materialsNeeded)) {
            // Buscamos suma total de materiales en inventario
            const matRes = await client.query('SELECT SUM(quantity) as total FROM player_items WHERE player_id = $1 AND template_id = $2', [userId, matId]);
            const currentQty = parseInt(matRes.rows[0].total || 0);
            
            if (currentQty < qtyNeeded) throw new Error(`Faltan materiales.`);
            
            // Lógica de resta inteligente (consumir stacks)
            let remainingToConsume = qtyNeeded;
            const stacksRes = await client.query('SELECT id, quantity FROM player_items WHERE player_id = $1 AND template_id = $2 ORDER BY quantity ASC', [userId, matId]);
            
            for (const stack of stacksRes.rows) {
                if (remainingToConsume <= 0) break;
                const take = Math.min(stack.quantity, remainingToConsume);
                
                if (take === stack.quantity) {
                    await client.query('DELETE FROM player_items WHERE id = $1', [stack.id]);
                } else {
                    await client.query('UPDATE player_items SET quantity = quantity - $1 WHERE id = $2', [take, stack.id]);
                }
                remainingToConsume -= take;
            }
        }

        // Actualizar Dinero
        await client.query(
            'UPDATE players SET gold = $1, silver = $2, copper = $3 WHERE id = $4',
            [newBalance.newGold, newBalance.newSilver, newBalance.newCopper, userId]
        );

        // Éxito y XP
        const isFirstCraft = (myProf.xp === 0 && myProf.level === 1);
        let successChance = Math.min(95, 70 + (myProf.level * 2));
        if (isFirstCraft) successChance = 100;
        
        if (rarityName === 'uncommon') successChance -= 5;
        if (rarityName === 'rare') successChance -= 15;
        if (rarityName === 'legendary') successChance -= 30;

        const isSuccess = (Math.random() * 100) <= successChance;
        let xpGained = recipe.xp_reward;
        
        if (rarityName === 'uncommon') xpGained = Math.floor(xpGained * 1.2);
        if (rarityName === 'rare') xpGained = Math.floor(xpGained * 1.5);
        if (rarityName === 'legendary') xpGained = Math.floor(xpGained * 2.0);

        if (!isSuccess) xpGained = Math.floor(xpGained / 2);

        let currentXp = myProf.xp + xpGained;
        let currentLevel = myProf.level;
        let leveledUp = false;
        while (true) {
            const requiredXp = PROF_XP_REQUIREMENTS[currentLevel] || 99999;
            if (currentXp >= requiredXp) {
                currentXp -= requiredXp;
                currentLevel++;
                leveledUp = true;
            } else { break; }
        }
        await client.query(`UPDATE player_professions SET xp = $1, level = $2 WHERE player_id = $3 AND profession_id = $4`, [currentXp, currentLevel, userId, myProf.profession_id]);

        if (isSuccess) {
            const tplRes = await client.query('SELECT * FROM items_templates WHERE id = $1', [recipe.result_item_template_id]);
            const template = tplRes.rows[0];
            const finalStats = generateRandomStats(template, rarityMultiplier, rarityName);

            await client.query(`
                INSERT INTO player_packages (player_id, item_template_id, quantity, data)
                VALUES ($1, $2, $3, $4)
            `, [userId, recipe.result_item_template_id, recipe.result_quantity, finalStats]);

            await client.query('COMMIT');
            res.json({ success: true, message: leveledUp ? "¡Nivel Subido!" : "¡Éxito!", detail: `Creado: ${recipe.result_quantity}x [${template.name}]. +${xpGained} XP.`, newLevel: currentLevel });
        } else {
            await client.query('COMMIT'); 
            res.json({ success: false, isCraftFail: true, message: "Fallo Crítico", detail: `Materiales rotos. +${xpGained} XP.` });
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
};