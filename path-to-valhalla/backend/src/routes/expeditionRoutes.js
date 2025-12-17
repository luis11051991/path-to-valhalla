const express = require('express');
const router = express.Router();
const expeditionController = require('../controllers/expeditionController');
const authMiddleware = require('../middleware/authMiddleware');

// 1. Obtener lista de zonas (El mapa)
// Esta ya la tenías, la dejamos igual.
router.get('/', authMiddleware, expeditionController.getExpeditions);

// 2. NUEVA RUTA: Obtener enemigos de una zona específica
// Esta es necesaria para mostrar las cartas de los monstruos cuando eliges una zona.
router.get('/:zoneId/enemies', authMiddleware, expeditionController.getZoneEnemies);

// 3. Iniciar la batalla (Motor V2)
// CAMBIO IMPORTANTE: Antes era .startExpedition, ahora es .startBattle
router.post('/start', authMiddleware, expeditionController.startBattle);

module.exports = router;