const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// General safety net for all API routes.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Tighter limit for endpoints that send an email (OTP spam / cost control).
// Keyed by email when present so one IP can't exhaust another user's inbox,
// and so switching IPs doesn't bypass the limit for a given email either.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email?.trim().toLowerCase();
    return email || ipKeyGenerator(req);
  },
  message: { error: 'Too many verification requests. Please wait a few minutes and try again.' },
});

// Stricter limit for login to slow down credential-stuffing / brute force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email?.trim().toLowerCase();
    const ip = ipKeyGenerator(req);
    return email ? `${ip}:${email}` : ip;
  },
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
});

module.exports = { apiLimiter, otpLimiter, loginLimiter };