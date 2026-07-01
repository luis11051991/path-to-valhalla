const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const achievementController = require('../controllers/achievementController');

router.get('/', authMiddleware, achievementController.getAchievements);
router.post('/claim-all', authMiddleware, achievementController.claimAllAchievements);
router.post('/progress', authMiddleware, achievementController.updateProgress);
router.post('/:achievementId/claim', authMiddleware, achievementController.claimAchievement);

module.exports = router;
