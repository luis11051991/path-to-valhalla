const express = require('express');
const router = express.Router();
const expeditionController = require('../../controllers/expeditionController');
const authMiddleware = require('../../middleware/authMiddleware');

// Bestiario (expuesto via expeditionController)
router.get('/', authMiddleware, expeditionController.getBestiary);

module.exports = router;