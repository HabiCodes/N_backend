const express = require('express');

const {
  registerRequest,
  verifyRegistration,
  requestForgotPassword,
  verifyForgotPassword,
  confirmForgotPassword,
  login,
  me,
  changePassword,
} = require('../controllers/authController');

const { requireAuth } = require('../middleware/auth');
const { otpLimiter, loginLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/register/request', otpLimiter, registerRequest);
router.post('/register/verify', verifyRegistration);

router.post('/login', loginLimiter, login);
router.get('/me', requireAuth, me);

router.post('/password-reset/request', otpLimiter, requestForgotPassword);
router.post('/password-reset/verify', verifyForgotPassword);
router.post('/password-reset/confirm', confirmForgotPassword);

router.post('/change-password', requireAuth, changePassword);

module.exports = router;