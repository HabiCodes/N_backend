const express = require('express');
const { search, updateFcmToken } = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/search', requireAuth, search); // GET /api/users/search?q=habi
router.post('/fcm-token', requireAuth, updateFcmToken);

module.exports = router;