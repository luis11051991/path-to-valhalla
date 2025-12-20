const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const authMiddleware = require('../middleware/authMiddleware');

// Obtener inventario de la tienda (Stock)
router.get('/items', authMiddleware, shopController.getShopItems);

// Comprar
router.post('/buy', authMiddleware, shopController.buyItem);

// Vender
router.post('/sell', authMiddleware, shopController.sellItem);

module.exports = router;