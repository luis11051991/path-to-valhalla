const express = require('express');
const router = express.Router();
const evolutionController = require('../controllers/evolutionController');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas protegidas (necesitan Token)
router.get('/options', authMiddleware, evolutionController.getEvolutionOptions);
router.post('/confirm', authMiddleware, evolutionController.evolvePlayer);

module.exports = router;