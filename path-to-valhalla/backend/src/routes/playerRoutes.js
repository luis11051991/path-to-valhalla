const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/player/choose-race — Elegir raza (registro)
router.post('/choose-race', authMiddleware, playerController.chooseRace);

// POST /api/player/train-stats — Distribuir puntos de estadísticas
router.post('/train-stats', authMiddleware, playerController.trainStats);

// POST /api/player/rent-bag — Alquilar bolsa extra
router.post('/rent-bag', authMiddleware, playerController.rentBag);

// GET /api/player/search — Buscar usuarios
router.get('/search', authMiddleware, playerController.searchUsers);

module.exports = router;
