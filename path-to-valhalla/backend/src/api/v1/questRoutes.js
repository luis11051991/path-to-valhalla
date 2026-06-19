const express = require('express');
const router = express.Router();
const questController = require('../../controllers/questController');
const authMiddleware = require('../../middleware/authMiddleware');

// Rutas de misiones (Hall of Valhalla)
router.get('/status', authMiddleware, questController.getQuestStatus);
router.post('/accept', authMiddleware, questController.acceptQuest);
router.post('/complete', authMiddleware, questController.completeQuest);
router.post('/refresh', authMiddleware, questController.refreshBoard); // Tablón semanal/diario

module.exports = router;
