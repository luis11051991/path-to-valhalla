const express = require('express');
const router = express.Router();
const PlayerController = require('./controllers/player.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Rutas públicas (sin autenticación)
router.get('/list', PlayerController.getList);
router.get('/search', PlayerController.searchByName);

// Rutas protegidas (requieren autenticación)
router.get('/profile', authenticate, PlayerController.getProfile);
router.put('/profile', authenticate, PlayerController.updateProfile);
router.get('/stats', authenticate, PlayerController.getStats);
router.put('/stats', authenticate, PlayerController.updateStats);

module.exports = router;