const express = require('express');
<<<<<<< HEAD
const { requireAuth } = require('../middleware/auth');
=======
>>>>>>> bde03ee (Updated few errors)
const { register, login, me, changePassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, changePassword);

module.exports = router;