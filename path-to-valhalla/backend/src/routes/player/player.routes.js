// Rutas de jugador
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { validate } = require('../../middlewares/validate.middleware');

// Importar controladores
const playerController = require('../../controllers/playerController');

// Rutas públicas (sin autenticación requerida)
// router.get('/list', playerController.getList);
// router.get('/search', playerController.searchByName);

// Rutas privadas (requieren autenticación)  
// router.put('/profile', authenticate, playerController.updateProfile);

module.exports = router;