const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const bankController = require('../controllers/bankController');

router.get('/status', authMiddleware, bankController.getBankStatus);
router.post('/deposit', authMiddleware, bankController.depositToBank);
router.post('/withdraw', authMiddleware, bankController.withdrawFromBank);

module.exports = router;
