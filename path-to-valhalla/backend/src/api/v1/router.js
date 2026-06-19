const express = require('express');
const router = express.Router();

// Importar routers por dominio
const authRoutes = require('./authRoutes');
const questRoutes = require('./questRoutes');
const shopRoutes = require('./shopRoutes');
const bankRoutes = require('./bankRoutes');
const expeditionRoutes = require('./expeditionRoutes');
const evolutionRoutes = require('./evolutionRoutes');
const packageRoutes = require('./packageRoutes');
const workshopRoutes = require('./workshopRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const bestiaryRoutes = require('./bestiaryRoutes');
const messageRoutes = require('./messageRoutes');

// Montar routers
router.use('/auth', authRoutes);
router.use('/quests', questRoutes);
router.use('/shop', shopRoutes);
router.use('/bank', bankRoutes);
router.use('/expeditions', expeditionRoutes);
router.use('/evolution', evolutionRoutes);
router.use('/packages', packageRoutes);
router.use('/workshop', workshopRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/bestiary', bestiaryRoutes);
router.use('/messages', messageRoutes);

module.exports = router;
