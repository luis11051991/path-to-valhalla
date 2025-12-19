const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas protegidas
router.get('/my-packages', authMiddleware, packageController.getMyPackages);
router.post('/claim', authMiddleware, packageController.claimPackage);

module.exports = router;