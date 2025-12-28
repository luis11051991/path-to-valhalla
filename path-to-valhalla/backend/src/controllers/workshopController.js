const pool = require('../config/db');

// Curva de XP de Profesión
const PROF_XP_REQUIREMENTS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500];

// --- HELPER: RNG para Stats (Convertir rangos en números fijos) ---
const generateRandomStats = (templateStats) => {
    const finalStats = {};
    if (!templateStats) return {};
    for (const [key, value] of Object.entries(templateStats)) {
        // Si es un array [min, max], generamos un número aleatorio
        if (Array.isArray(value) && value.length === 2) {
            finalStats[key] = Math.floor(Math.random() * (value[1] - value[0] + 1)) + value[0];
        } else {
            // Si es un valor fijo, lo mantenemos
            finalStats[key] = value;
        }
    }
    return finalStats;
};

// 1. ELEGIR PROFESIÓN
exports.chooseProfession = async (req, res) => {
    const userId = req.user.id;
    const { profession } = req.body;

    try {
        const playerRes = await pool.query('SELECT level, profession FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        if (player.level < 5) return res.status(400).json({ message: "Necesitas ser Nivel 5." });
        if (player.profession) return res.status(400).json({ message: "Ya tienes una profesión." });

        const initialRecipes = [1]; 

        await pool.query(
            'UPDATE players SET profession = $1, learned_recipes = $2, profession_level = 1, profession_xp = 0 WHERE id = $3',
            [profession, JSON.stringify(initialRecipes), userId]
        );

        res.json({ success: true, message: `¡Ahora eres un ${profession}!`, profession });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al elegir profesión." });
    }
};

// 2. OBTENER DATOS
exports.getWorkshopData = async (req, res) => {
    const userId = req.user.id;
    try {
        const playerRes = await pool.query('SELECT profession, profession_level, profession_xp, learned_recipes FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        if (!player.profession) return res.json({ success: true, hasProfession: false });

        const recipeIds = player.learned_recipes || [];
        let recipes = [];
        
        if (recipeIds.length > 0) {
            const recipesRes = await pool.query(`
                SELECT r.*, 
                       it.name as result_name, 
                       it.image_url as result_image, 
                       it.rarity,
                       it.type,
                       it.base_stats,
                       it.description as item_desc
                FROM recipes r
                JOIN items_templates it ON r.result_item_template_id = it.id
                WHERE r.id = ANY($1::int[])
            `, [recipeIds]);
            recipes = recipesRes.rows;
        }

        res.json({ 
            success: true, 
            hasProfession: true, 
            profession: player.profession,
            level: player.profession_level || 1,
            xp: player.profession_xp || 0,
            nextLevelXp: PROF_XP_REQUIREMENTS[player.profession_level || 1] || 99999,
            recipes 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error cargando taller." });
    }
};

// 3. CRAFTEAR (Corregido para generar stats fijos)
exports.craftItem = async (req, res) => {
    const userId = req.user.id;
    const { recipeId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Validaciones
        const recipeRes = await client.query('SELECT * FROM recipes WHERE id = $1', [recipeId]);
        if (recipeRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ message: "Receta no existe." }); }
        const recipe = recipeRes.rows[0];

        const playerRes = await client.query('SELECT * FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        if (parseInt(player.copper) < recipe.cost_gold) { 
            await client.query('ROLLBACK'); 
            return res.status(400).json({ message: "No tienes suficiente cobre." }); 
        }

        // XP y Nivel
        let currentXp = player.profession_xp || 0;
        let currentLevel = player.profession_level || 1;
        let newXp = currentXp + recipe.xp_reward;
        const requiredXp = PROF_XP_REQUIREMENTS[currentLevel] || 99999;
        
        if (newXp >= requiredXp) {
            newXp -= requiredXp;
            currentLevel++;
        }

        // Cobrar y dar XP
        await client.query(
            'UPDATE players SET copper = copper - $1, profession_xp = $2, profession_level = $3 WHERE id = $4',
            [recipe.cost_gold, newXp, currentLevel, userId]
        );

        // --- CORRECCIÓN: GENERAR STATS FIJOS AHORA ---
        const tplRes = await client.query('SELECT base_stats FROM items_templates WHERE id = $1', [recipe.result_item_template_id]);
        const templateStats = tplRes.rows[0].base_stats;

        // Aquí ocurre la magia: Convertimos [10, 20] -> 15
        const finalItemStats = generateRandomStats(templateStats);

        // Insertamos en player_packages con los stats YA CALCULADOS
        await client.query(`
            INSERT INTO player_packages (player_id, item_template_id, quantity, data)
            VALUES ($1, $2, $3, $4)
        `, [userId, recipe.result_item_template_id, recipe.result_quantity, finalItemStats]);

        await client.query('COMMIT');
        
        res.json({ 
            success: true, 
            message: "¡Trabajo completado!", 
            detail: `Has forjado ${recipe.result_quantity}x Objeto. Revisa tus Paquetes.` 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
};
