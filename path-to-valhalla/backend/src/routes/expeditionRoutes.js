const express = require('express');
const router = express.Router();
const expeditionController = require('../controllers/expeditionController');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas protegidas
router.get('/', authMiddleware, expeditionController.getExpeditions);
router.post('/start', authMiddleware, expeditionController.startExpedition);

module.exports = router;