const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const skillController = require('../controllers/skillController');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/skills — Mis habilidades
router.get('/', authMiddleware, playerController.getMySkills);

// POST /api/skills/equip — Equipar/desequipar habilidad
router.post('/equip', authMiddleware, playerController.equipSkill);

// POST /api/skills/upgrade — Mejorar habilidad
router.post('/upgrade', authMiddleware, skillController.upgradeSkill);

module.exports = router;
