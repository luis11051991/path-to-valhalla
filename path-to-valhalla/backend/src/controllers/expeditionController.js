const pool = require('../config/db');

// --- LISTAR EXPEDICIONES (Para el Mapa) ---
exports.getExpeditions = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM expeditions ORDER BY level_req ASC');
        res.json({ success: true, expeditions: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error cargando mapa.' });
    }
};

// --- INICIAR BATALLA ---
exports.startExpedition = async (req, res) => {
    const { userId, expeditionId } = req.body;

    try {
        // 1. Obtener Datos
        const playerRes = await pool.query('SELECT * FROM players WHERE id = $1', [userId]);
        const expRes = await pool.query('SELECT * FROM expeditions WHERE id = $1', [expeditionId]);

        if (playerRes.rows.length === 0 || expRes.rows.length === 0) {
            return res.status(404).json({ message: 'Misión no encontrada.' });
        }

        const player = playerRes.rows[0];
        const mission = expRes.rows[0];

        // 2. Validaciones
        if (player.level < mission.level_req) return res.status(400).json({ message: `Nivel insuficiente. Requiere Lvl ${mission.level_req}.` });
        if (player.energy < mission.energy_cost) return res.status(400).json({ message: 'Sin energía suficiente.' });
        if (player.current_hp <= 5) return res.status(400).json({ message: 'Estás muy herido para pelear.' });

        // 3. CÁLCULO DE PROBABILIDAD DE VICTORIA
        // Base 50%. +2% por cada punto de stat que supere el requisito.
        let winChance = 50;
        const reqStats = mission.min_stat_req || {};
        const playerStats = player.stats || {};

        // Analizar Fuerza, Destreza, etc.
        Object.keys(reqStats).forEach(stat => {
            const playerVal = playerStats[stat] || 0;
            const reqVal = reqStats[stat] || 0;
            const diff = playerVal - reqVal;
            winChance += (diff * 2); 
        });

        // Topes (Mínimo 10%, Máximo 95%)
        if (winChance > 95) winChance = 95;
        if (winChance < 10) winChance = 10;

        // 4. TIRAR EL DADO
        const roll = Math.floor(Math.random() * 100) + 1;
        const isSuccess = roll <= winChance;

        // 5. RESULTADOS
        let logText = "";
        let rewards = { xp: 0, copper: 0 };
        let hpLoss = 0;

        await pool.query('BEGIN');

        // Consumir energía SIEMPRE
        await pool.query('UPDATE players SET energy = GREATEST(0, energy - $1) WHERE id = $2', [mission.energy_cost, userId]);

        if (isSuccess) {
            // --- VICTORIA ---
            // Calcular recompensa en Cobre
            const copperGain = Math.floor(Math.random() * (mission.money_reward_max - mission.money_reward_min + 1)) + mission.money_reward_min;
            const xpGain = mission.xp_reward;
            
            // Daño pequeño al ganar (1 a 10% de vida máx aprox, simplificado aquí)
            hpLoss = Math.floor(Math.random() * 5) + 2; 

            logText = `¡Victoria en ${mission.name}! Venciste a los enemigos.`;
            rewards = { xp: xpGain, copper: copperGain };

            // ACTUALIZAR JUGADOR (Sumar XP y Dinero Inteligente)
            // Primero obtenemos el dinero actual para sumar correctamente G/S/C
            const currentMoney = (parseInt(player.gold) * 10000) + (parseInt(player.silver) * 100) + parseInt(player.copper);
            const newTotalMoney = currentMoney + copperGain;
            
            const newGold = Math.floor(newTotalMoney / 10000);
            const remGold = newTotalMoney % 10000;
            const newSilver = Math.floor(remGold / 100);
            const newCopper = remGold % 100;

            await pool.query(
                `UPDATE players 
                 SET experience = experience + $1, 
                     gold = $2, silver = $3, copper = $4,
                     current_hp = GREATEST(0, current_hp - $5) 
                 WHERE id = $6`,
                [xpGain, newGold, newSilver, newCopper, hpLoss, userId]
            );

        } else {
            // --- DERROTA ---
            hpLoss = Math.floor(Math.random() * 15) + 10; // Daño fuerte
            logText = `Has sido derrotado en ${mission.name}. Tuviste que huir.`;
            
            await pool.query(
                'UPDATE players SET current_hp = GREATEST(0, current_hp - $1) WHERE id = $2',
                [hpLoss, userId]
            );
        }

        // 6. Guardar Historial
        await pool.query(
            'INSERT INTO expedition_logs (player_id, expedition_id, success, log_text, rewards) VALUES ($1, $2, $3, $4, $5)',
            [userId, expeditionId, isSuccess, logText, JSON.stringify(rewards)]
        );

        // 7. Devolver estado final del jugador
        const updatedUserRes = await pool.query(`SELECT * FROM players WHERE id = $1`, [userId]);
        await pool.query('COMMIT');

        res.json({
            success: true,
            result: {
                won: isSuccess,
                roll,
                winChance,
                log: logText,
                rewards,
                hpLoss
            },
            user: updatedUserRes.rows[0]
        });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error en la expedición.' });
    }
};