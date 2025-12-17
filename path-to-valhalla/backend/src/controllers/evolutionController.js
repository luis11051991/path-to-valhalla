const pool = require('../config/db');

// --- 1. OBTENER OPCIONES DE EVOLUCIÓN ---
exports.getEvolutionOptions = async (req, res) => {
    const userId = req.user.id; 

    try {
        // A. Obtener datos actuales del jugador
        const playerQuery = `
            SELECT p.id, p.level, p.race, p.class_id, c.tier, c.name as class_name
            FROM players p
            LEFT JOIN classes c ON p.class_id = c.id
            WHERE p.id = $1
        `;
        const playerRes = await pool.query(playerQuery, [userId]);
        if (playerRes.rows.length === 0) return res.status(404).json({ message: 'Jugador no encontrado' });
        
        const player = playerRes.rows[0];

        // --- CORRECCIÓN DE SEGURIDAD ---
        // Si el jugador no tiene clase (class_id es null), asumimos que es Tier 0 (Novato)
        // y buscamos su clase base según su raza para corregirlo al vuelo.
        let currentTier = player.tier;
        let currentClassId = player.class_id;

        if (currentTier === null || currentTier === undefined) {
            // Es un personaje nuevo sin clase asignada. Lo tratamos como Tier 0.
            currentTier = 0;
            
            // Intentamos encontrar su clase base para mostrar las opciones correctas
            // (Esto es un "parche" visual, lo ideal es el SQL que te pasé)
            const baseClassRes = await pool.query("SELECT id FROM classes WHERE name ILIKE $1", [player.race]); // Buscamos por nombre de raza aprox
            if (baseClassRes.rows.length > 0) {
                currentClassId = baseClassRes.rows[0].id;
            }
        }

        // B. Validar requisitos (Ahora currentTier 0 pide nivel 10)
        let requiredLevel = 999;
        if (currentTier === 0) requiredLevel = 10;
        else if (currentTier === 1) requiredLevel = 50;
        else if (currentTier === 2) requiredLevel = 100;

        if (player.level < requiredLevel) {
            return res.json({ 
                available: false, 
                message: `Necesitas ser nivel ${requiredLevel} para evolucionar.` 
            });
        }

        // C. Buscar evoluciones
        const optionsQuery = `
            SELECT id, name, description, image_url, base_stats 
            FROM classes 
            WHERE parent_id = $1
        `;
        
        // Si no tenía class_id, esto podría fallar, por eso es vital el SQL anterior.
        // Pero si hicimos el parche arriba, intentará buscar hijos de la clase base.
        const parentToSearch = currentClassId || 99999; 
        
        const optionsRes = await pool.query(optionsQuery, [parentToSearch]);

        if (optionsRes.rows.length === 0) {
            // Fallback: Si no encontramos opciones, sugerimos al usuario contactar soporte o revisar datos
            return res.json({ available: false, message: 'No se encontraron caminos para tu clase actual.' });
        }

        res.json({
            available: true,
            currentTier: currentTier,
            nextTier: currentTier + 1,
            options: optionsRes.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al buscar evoluciones' });
    }
};

// --- 2. EJECUTAR EVOLUCIÓN (CONFIRMAR) ---
exports.evolvePlayer = async (req, res) => {
    const userId = req.user.id;
    const { targetClassId } = req.body; 

    try {
        await pool.query('BEGIN');

        const playerRes = await pool.query('SELECT level, class_id FROM players WHERE id = $1', [userId]);
        const player = playerRes.rows[0];

        // Verificar validez (Si no tiene clase, esto fallará, el usuario DEBE tener clase base)
        const classCheckRes = await pool.query('SELECT * FROM classes WHERE id = $1', [targetClassId]);
        
        if (classCheckRes.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: 'Clase destino no válida.' });
        }
        
        const newClass = classCheckRes.rows[0];

        if (player.level < newClass.min_level) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ message: `Nivel insuficiente. Requiere ${newClass.min_level}.` });
        }

        const pointsRefund = (player.level - 1) * 5;
        const newStats = newClass.base_stats; 

        await pool.query(
            `UPDATE players 
            SET class_id = $1, 
                stats = $2, 
                stat_points = $3,
                evolution_quest_status = 'completed'
            WHERE id = $4`,
            [targetClassId, newStats, pointsRefund, userId]
        );
        
        const finalUserRes = await pool.query(`
            SELECT p.*, c.image_url as class_image, c.name as class_name
            FROM players p
            LEFT JOIN classes c ON p.class_id = c.id
            WHERE p.id = $1
        `, [userId]);

        const updatedUser = finalUserRes.rows[0];

        await pool.query('COMMIT');

        res.json({
            success: true,
            message: `¡Has evolucionado a ${newClass.name}! Tus puntos han sido reseteados.`,
            user: updatedUser
        });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error en la evolución.' });
    }
};