const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const statisticsController = require('../controllers/statisticsController');

router.get('/', authMiddleware, statisticsController.getStatistics);

module.exports = router;
