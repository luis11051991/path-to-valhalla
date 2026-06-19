const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/inventoryController');
const authMiddleware = require('../../middleware/authMiddleware');

router.post('/move', authMiddleware, inventoryController.moveItem);
router.post('/organize', authMiddleware, inventoryController.organizeInventory);
router.post('/use', authMiddleware, inventoryController.useItem);

module.exports = router;