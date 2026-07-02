const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const allianceController = require('../controllers/allianceController');

router.use(authMiddleware);

router.get('/', allianceController.listAlliances);
router.post('/', allianceController.createAlliance);

router.get('/me', allianceController.getMyAlliance);
router.get('/me/donations', allianceController.getDonationInfo);
router.get('/me/members', allianceController.getMembers);
router.patch('/me/settings', allianceController.updateSettings);
router.delete('/me', allianceController.disbandAlliance);

router.post('/donate', allianceController.donate);
router.post('/leave', allianceController.leaveAlliance);
router.post('/transfer-leadership', allianceController.transferLeadership);

router.post('/applications/:applicationId/accept', allianceController.acceptApplication);
router.post('/applications/:applicationId/reject', allianceController.rejectApplication);

router.post('/buildings/:buildingId/upgrade', allianceController.upgradeBuilding);
router.get('/judgements', allianceController.getJudgements);
router.post('/judgements', allianceController.startJudgement);
router.get('/judgements/eligible-members', allianceController.getEligibleJudgementMembers);
router.post('/judgements/:judgementId/vote', allianceController.voteJudgement);
router.post('/judgements/:judgementId/resolve', allianceController.resolveJudgement);
router.post('/members/:memberId/promote', allianceController.promoteMember);
router.post('/members/:memberId/demote', allianceController.demoteMember);
router.delete('/members/:memberId', allianceController.kickMember);

router.get('/:allianceId', allianceController.getPublicProfile);
router.post('/:allianceId/apply', allianceController.applyToAlliance);
router.get('/:allianceId/applications', allianceController.getApplications);

module.exports = router;
