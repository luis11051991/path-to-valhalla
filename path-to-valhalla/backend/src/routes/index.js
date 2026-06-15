// Archivo principal de rutas que monta todas las rutas por versión
const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth/auth.routes');
const playerRoutes = require('./player/player.routes');
const inventoryRoutes = require('./inventory/inventory.routes');
const firebaseAuthRoutes = require('./firebaseAuthRoutes.js');
// const expeditionRoutes = require('./expedition/index.js');
// const questRoutes = require('./quest/quest.routes');
// const shopRoutes = require('./shop/shop.routes');
// const workshopRoutes = require('./workshop/workshop.routes');
// const bankRoutes = require('./bank/bank.routes');
// const messageRoutes = require('./message/message.routes');
// const petRoutes = require('./pet/pet.routes');
// const backgroundRoutes = require('./background/background.routes');
// const skillRoutes = require('./skill/skill.routes');
// const evolutionRoutes = require('./evolution/evolution.routes');

// Montar rutas bajo /api/v1
router.use('/v1/auth', authRoutes);
router.use('/v1/player', playerRoutes);
router.use('/v1/inventory', inventoryRoutes);
router.use('/v1/firebase-auth', firebaseAuthRoutes);


// Rutas de salud
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'backend'
  });
});

router.get('/ready', (req, res) => {
  res.json({
    status: 'READY',
    timestamp: new Date().toISOString(),
    service: 'backend'
  });
});

// Rutas de administración
const adminRoutes = require('./admin/admin.routes');

// Para que las rutas de admin estén disponibles en modo development
if (process.env.NODE_ENV !== 'production') {
  router.use('/v1/admin', adminRoutes);
}

module.exports = router;