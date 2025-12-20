const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const authMiddleware = require('../middleware/authMiddleware');

// Obtener inventario de la tienda (Stock Actual)
router.get('/items', authMiddleware, shopController.getShopItems);

// Refrescar Stock (Gacha)
router.post('/refresh', authMiddleware, shopController.refreshShop); // <--- NUEVA RUTA

// Comprar
router.post('/buy', authMiddleware, shopController.buyItem);

// Vender
router.post('/sell', authMiddleware, shopController.sellItem);

module.exports = router;