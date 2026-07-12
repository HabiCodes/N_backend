const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { register, login, me, changePassword } = require('../controllers/authController');
router.post('/change-password', requireAuth, changePassword);

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, me);

module.exports = router;
