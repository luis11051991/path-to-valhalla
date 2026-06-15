const express = require('express');
const router = express.Router();
const ExpeditionController = require('../../modules/expedition/controllers/expedition.controller');
const { authenticate } = require('../../middleware/authMiddleware');

// Rutas protegidas (requieren autenticación)
router.post('/', authenticate, ExpeditionController.createExpedition);
router.get('/:expeditionId', authenticate, ExpeditionController.getExpedition);
router.get('/mine', authenticate, ExpeditionController.getPlayerExpeditions);
router.post('/:expeditionId/join', authenticate, ExpeditionController.joinExpedition);
router.delete('/:expeditionId/leave', authenticate, ExpeditionController.leaveExpedition);
router.put('/:expeditionId/status', authenticate, ExpeditionController.updateExpeditionStatus);
router.get('/public', authenticate, ExpeditionController.getPublicExpeditions);
router.post('/:expeditionId/complete', authenticate, ExpeditionController.completeExpedition);
router.post('/:expeditionId/cancel', authenticate, ExpeditionController.cancelExpedition);

module.exports = router;