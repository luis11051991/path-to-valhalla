const express = require('express');
const router = express.Router();
const InventoryController = require('./controllers/inventory.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Rutas protegidas (requieren autenticación)
router.get('/', authenticate, InventoryController.getFullInventory);
router.get('/page/:page?', authenticate, InventoryController.getInventory);
router.get('/:itemId', authenticate, InventoryController.getItem);
router.post('/', authenticate, InventoryController.addItem);
router.put('/:itemId/quantity', authenticate, InventoryController.updateItemQuantity);
router.delete('/:itemId', authenticate, InventoryController.removeItem);
router.post('/:itemId/use', authenticate, InventoryController.useItem);
router.get('/type/:type', authenticate, InventoryController.getItemsByType);

module.exports = router;