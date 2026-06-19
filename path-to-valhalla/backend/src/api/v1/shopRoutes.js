const express = require('express');
const router = express.Router();
const shopController = require('../../controllers/shopController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/items', authMiddleware, shopController.getShopItems);
router.post('/refresh', authMiddleware, shopController.refreshShop);
router.post('/buy', authMiddleware, shopController.buyItem);
router.post('/sell', authMiddleware, shopController.sellItem);

module.exports = router;
