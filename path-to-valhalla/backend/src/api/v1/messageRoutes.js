const express = require('express');
const router = express.Router();
const messageController = require('../../controllers/messageController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/inbox', authMiddleware, messageController.getMyMessages);
router.get('/unread-count', authMiddleware, messageController.getUnreadCount);
router.post('/read', authMiddleware, messageController.markAsRead);

module.exports = router;