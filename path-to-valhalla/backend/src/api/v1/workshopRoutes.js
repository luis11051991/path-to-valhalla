const express = require('express');
const router = express.Router();
const workshopController = require('../../controllers/workshopController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/data', authMiddleware, workshopController.getWorkshopData);
router.post('/craft', authMiddleware, workshopController.craftItem);
router.post('/profession', authMiddleware, workshopController.chooseProfession);

module.exports = router;