const express = require('express');
const router = express.Router();
const evolutionController = require('../controllers/evolutionController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/options', authMiddleware, evolutionController.getEvolutionOptions);
router.post('/start', authMiddleware, evolutionController.startEvolutionPath);
router.post('/reconsider', authMiddleware, evolutionController.reconsiderPath);

module.exports = router;