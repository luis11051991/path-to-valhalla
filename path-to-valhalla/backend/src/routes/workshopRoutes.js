const express = require('express');
const router = express.Router();
const workshopController = require('../controllers/workshopController');
// CORRECCIÓN AQUÍ: Agregamos 'Middleware' al final del nombre
const auth = require('../middleware/authMiddleware'); 

// Ruta base: /api/workshop

// 1. Obtener datos del taller (Nivel, recetas, etc.)
router.get('/', auth, workshopController.getWorkshopData);

// 2. Elegir profesión (Solo una vez)
router.post('/choose', auth, workshopController.chooseProfession);

// 3. Crear (Craftear) un objeto
router.post('/craft', auth, workshopController.craftItem);

module.exports = router;    