const express = require('express');
const router = express.Router();

// Auth module routes (v1 modular)
const authV1Controller = require('../../controllers/v1/authController');
const authMiddleware = require('../../middleware/authMiddleware');
const authValidators = require('../../validators/authValidators');

router.post('/register', authValidators.validateRegister, authV1Controller.register);
router.post('/login', authValidators.validateLogin, authV1Controller.login);
router.get('/me', authMiddleware, authV1Controller.getProfile);

module.exports = router;
