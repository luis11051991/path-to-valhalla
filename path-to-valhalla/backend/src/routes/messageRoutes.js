const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas protegidas por autenticación
router.post('/send', authMiddleware, messageController.sendMessage);
router.get('/', authMiddleware, messageController.getMyMessages);
router.get('/unread', authMiddleware, messageController.getUnreadCount);
router.post('/read', authMiddleware, messageController.markAsRead);

module.exports = router;
