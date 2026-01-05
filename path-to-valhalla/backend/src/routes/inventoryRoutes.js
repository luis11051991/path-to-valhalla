const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/authMiddleware'); // O '../middleware/auth' si así se llama tu archivo

// 1. Ruta para MOVER (Equipar/Desequipar) - ¡ESTA FALTABA O ESTABA ROTA!
router.post('/move', authMiddleware, inventoryController.moveItem);

// 2. Ruta para ORGANIZAR
router.post('/organize', authMiddleware, inventoryController.organizeInventory);

// 3. Ruta para USAR (Pociones/Recetas)
router.post('/use', authMiddleware, inventoryController.useItem);

module.exports = router;