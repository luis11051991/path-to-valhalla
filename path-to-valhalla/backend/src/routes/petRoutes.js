const express = require('express');
const router = express.Router();
const petController = require('../controllers/petController');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/pets — Mis mascotas
router.get('/', authMiddleware, petController.getMyPets);

// POST /api/pets/equip — Equipar mascota
router.post('/equip', authMiddleware, petController.equipPet);

// POST /api/pets/feed — Alimentar mascota
router.post('/feed', authMiddleware, petController.feedPet);

module.exports = router;
