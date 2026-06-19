const express = require('express');
const router = express.Router();
const packageController = require('../../controllers/packageController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/my', authMiddleware, packageController.getMyPackages);
router.post('/claim/:id', authMiddleware, packageController.claimPackage);

module.exports = router;