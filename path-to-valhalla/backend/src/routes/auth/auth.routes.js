// Rutas de autenticación
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');

// Importar controladores
const authController = require('../../controllers/authController');

// Rutas públicas (sin autenticación requerida)
router.post('/login',
  validate('login'), // Validación de campo login
  authController.login
);

router.post('/register',
  validate('register'), // Validación de registro
  authController.register
);

router.post('/firebase-login', authController.firebaseLogin);

// Rutas privadas (requieren autenticación)  
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/logout', authenticate, authController.logout);

module.exports = router;