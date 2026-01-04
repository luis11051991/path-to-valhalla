const express = require('express');
const router = express.Router();
const expeditionController = require('../controllers/expeditionController');
const authMiddleware = require('../middleware/authMiddleware');

// --- BORRA LA LÍNEA DE /bestiary DE AQUÍ ---

// 1. Obtener lista de zonas
router.get('/', authMiddleware, expeditionController.getExpeditions);

// 2. Obtener enemigos
router.get('/:zoneId/enemies', authMiddleware, expeditionController.getZoneEnemies);

// 3. Iniciar batalla
router.post('/start', authMiddleware, expeditionController.startBattle);

module.exports = router;