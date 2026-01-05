const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/authMiddleware'); // Asegúrate de que esta ruta sea correcta, a veces es '../middleware/auth'

// Rutas de Inventario
router.post('/move', authMiddleware, inventoryController.moveItem);
router.post('/organize', authMiddleware, inventoryController.organizeInventory);
router.post('/use', authMiddleware, inventoryController.useItem); // <--- ESTA ES LA QUE FALTABA

module.exports = router;