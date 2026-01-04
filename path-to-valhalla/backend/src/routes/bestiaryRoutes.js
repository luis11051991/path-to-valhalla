const express = require('express');
const router = express.Router();
const expeditionController = require('../controllers/expeditionController'); // Reusamos el controlador que ya funciona
const authMiddleware = require('../middleware/authMiddleware');

// Ruta: /api/bestiary
router.get('/', authMiddleware, expeditionController.getBestiary);

module.exports = router;