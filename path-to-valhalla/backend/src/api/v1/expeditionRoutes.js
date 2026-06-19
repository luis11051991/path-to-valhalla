const express = require('express');
const router = express.Router();
const expeditionController = require('../../controllers/expeditionController');
const authMiddleware = require('../../middleware/authMiddleware');

// Expeditions (combina expediciones y bestiario)
router.get('/', authMiddleware, expeditionController.getExpeditions);
router.get('/:zoneId/enemies', authMiddleware, expeditionController.getZoneEnemies);
router.post('/start', authMiddleware, expeditionController.startBattle);
router.get('/bestiary', authMiddleware, expeditionController.getBestiary);

module.exports = router;