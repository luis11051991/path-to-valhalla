const express = require('express');
const router = express.Router();
const bgController = require('../controllers/backgroundController');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/backgrounds — Catálogo de fondos (público, userId opcional en query)
router.get('/', bgController.getBackgrounds);

// POST /api/backgrounds/equip — Equipar fondo (protegido)
router.post('/equip', authMiddleware, bgController.equipBackground);

// POST /api/backgrounds/buy — Comprar fondo (protegido)
router.post('/buy', authMiddleware, bgController.buyBackground);

module.exports = router;
