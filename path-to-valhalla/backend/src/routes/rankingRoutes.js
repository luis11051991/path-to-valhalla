const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const rankingController = require('../controllers/rankingController');

router.get('/heroes', authMiddleware, rankingController.getHeroes);
router.get('/alliances', authMiddleware, rankingController.getAlliances);

module.exports = router;
