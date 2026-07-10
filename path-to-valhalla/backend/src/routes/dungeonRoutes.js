const express = require('express');
const router = express.Router();
const dungeonController = require('../controllers/dungeonController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/types', authMiddleware, dungeonController.getDungeonTypes);

router.post('/rooms', authMiddleware, dungeonController.createRoom);
router.get('/rooms', authMiddleware, dungeonController.listRooms);
router.get('/rooms/:code', authMiddleware, dungeonController.getRoom);
router.post('/rooms/:code/join', authMiddleware, dungeonController.joinRoom);
router.post('/rooms/:code/leave', authMiddleware, dungeonController.leaveRoom);
router.post('/rooms/:code/ready', authMiddleware, dungeonController.toggleReady);
router.post('/rooms/:code/start', authMiddleware, dungeonController.startRun);
router.post('/rooms/:code/cancel', authMiddleware, dungeonController.cancelRoom);
router.post('/rooms/:code/fill-npcs', authMiddleware, dungeonController.fillNPCs);

router.get('/runs/:runId', authMiddleware, dungeonController.getRun);
router.post('/runs/:runId/advance', authMiddleware, dungeonController.advanceRoom);
router.get('/runs/:runId/log', authMiddleware, dungeonController.getRunLog);

router.post('/loot/:rollId/roll', authMiddleware, dungeonController.submitRoll);

router.get('/my-runs', authMiddleware, dungeonController.getMyActiveRuns);
router.get('/my-active-room', authMiddleware, dungeonController.getMyActiveRoom);

module.exports = router;
