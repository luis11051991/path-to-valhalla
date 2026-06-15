// Rutas de inventario
const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/authMiddleware');
const { validate } = require('../../middlewares/validate.middleware');

// Importar controladores
const inventoryController = require('../../controllers/inventoryController');

// Rutas protegidas (requieren autenticación)
// router.get('/', authenticate, inventoryController.getFullInventory);
// router.get('/page/:page?', authenticate, inventoryController.getInventory);
// router.get('/:itemId', authenticate, inventoryController.getItem);
// router.post('/', authenticate, inventoryController.addItem);
// router.put('/:itemId/quantity', authenticate, inventoryController.updateItemQuantity);
// router.delete('/:itemId', authenticate, inventoryController.removeItem);
// router.post('/:itemId/use', authenticate, inventoryController.useItem);
// router.get('/type/:type', authenticate, inventoryController.getItemsByType);

module.exports = router;