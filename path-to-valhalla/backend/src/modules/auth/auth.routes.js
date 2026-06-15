const express = require('express');
const router = express.Router();
const AuthController = require('./controllers/auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Rutas de autenticación
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);

// Rutas protegidas
router.get('/profile', authenticate, AuthController.getProfile);
router.put('/profile', authenticate, AuthController.updateProfile);
router.post('/logout', authenticate, AuthController.logout);

module.exports = router;