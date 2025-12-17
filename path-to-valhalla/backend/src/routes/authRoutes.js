const express = require('express');
const router = express.Router();
// Importamos el controlador (donde ahora SÍ existe getProfile)
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas
router.post('/register', authController.register);
router.post('/login', authController.login);

// Esta línea es la que fallaba porque authController.getProfile era "undefined"
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;