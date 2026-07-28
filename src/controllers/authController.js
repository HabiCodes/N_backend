const bcrypt = require('bcryptjs');

const UserModel = require('../models/userModel');
const PasswordResetModel = require('../models/passwordResetModel');
const PendingRegistrationModel = require('../models/pendingRegistrationModel');

const {
  signToken,
  verifyToken,
} = require('../utils/jwt');

const {
  isValidEmail,
  isValidPassword,
  isValidUsername,
} = require('../utils/validators');

const { generateOtp } = require('../utils/otp');
const { sendVerificationEmail } = require('../services/emailService');

const { query } = require('../config/db');


// ============================================================
// REGISTER - REQUEST EMAIL VERIFICATION
// POST /api/auth/register/request
// ============================================================

async function registerRequest(req, res, next) {
  try {
    const { username, password } = req.body;

    const email = req.body.email?.trim().toLowerCase();

    // -------------------------
    // Validate username
    // -------------------------

    if (!isValidUsername(username)) {
      return res.status(400).json({
        error: 'Username must be 3-30 chars, letters/numbers/underscore only',
      });
    }

    // -------------------------
    // Validate email
    // -------------------------

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email address',
      });
    }

    // -------------------------
    // Validate password
    // -------------------------

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters',
      });
    }

    // -------------------------
    // Check if user already exists
    // -------------------------

    const existingUser = await UserModel.findByEmail(email);

    if (existingUser) {
      return res.status(409).json({
        error: 'An account with that email already exists',
      });
    }

    // -------------------------
    // Generate OTP
    // -------------------------

    const otp = generateOtp();

    const otpHash = await bcrypt.hash(otp, 10);

    const passwordHash = await bcrypt.hash(password, 10);

    const otpExpiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // -------------------------
    // Remove previous pending registration
    // -------------------------

    const existingPending =
      await PendingRegistrationModel.findByEmail(email);

    if (existingPending) {
      await PendingRegistrationModel.deleteByEmail(email);
    }

    // -------------------------
    // Save pending registration
    // -------------------------

    await PendingRegistrationModel.create({
      username,
      email,
      passwordHash,
      otpHash,
      otpExpiresAt,
    });

    // -------------------------
    // Send OTP email
    // -------------------------

    await sendVerificationEmail(email, otp);

    // Respond immediately - don't make the client wait on Gmail's SMTP
    // round-trip, which can be slow and stacks with Render cold-start time.
    res.status(200).json({
      message: 'Verification code sent to your email',
    });

    sendVerificationEmail(email, otp).catch((err) => {
      console.error('Failed to send verification email (after response sent):', err.message);
    });

  } catch (err) {
    next(err);
  }
}


// ============================================================
// REGISTER - VERIFY EMAIL OTP
// POST /api/auth/register/verify
// ============================================================

async function verifyRegistration(req, res, next) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { code } = req.body;

    // -------------------------
    // Validate input
    // -------------------------

    if (!isValidEmail(email) || !code) {
      return res.status(400).json({
        error: 'Email and verification code are required',
      });
    }

    // -------------------------
    // Find pending registration
    // -------------------------

    const pendingRegistration =
      await PendingRegistrationModel.findByEmail(email);

    if (!pendingRegistration) {
      return res.status(404).json({
        error: 'No pending registration found',
      });
    }

    // -------------------------
    // Check expiry
    // -------------------------

    if (
      new Date() >
      new Date(pendingRegistration.otp_expires_at)
    ) {
      await PendingRegistrationModel.deleteByEmail(email);

      return res.status(400).json({
        error: 'Verification code has expired',
      });
    }

    // -------------------------
    // Check attempts
    // -------------------------

    if (pendingRegistration.otp_attempts >= 5) {
      await PendingRegistrationModel.deleteByEmail(email);

      return res.status(429).json({
        error: 'Too many incorrect attempts. Please register again.',
      });
    }

    // -------------------------
    // Compare OTP
    // -------------------------

    const codeMatches = await bcrypt.compare(
      code,
      pendingRegistration.otp_hash
    );

    if (!codeMatches) {
      await PendingRegistrationModel.incrementAttempts(
        pendingRegistration.id
      );

      return res.status(400).json({
        error: 'Invalid verification code',
      });
    }

    // -------------------------
    // Create real user
    // -------------------------

    const user = await UserModel.create({
      username: pendingRegistration.username,
      email: pendingRegistration.email,
      passwordHash: pendingRegistration.password_hash,
    });

    // -------------------------
    // Delete pending registration
    // -------------------------

    await PendingRegistrationModel.deleteByEmail(email);

    // -------------------------
    // Login token
    // -------------------------

    const token = signToken({
      userId: user.id,
    });

    res.status(201).json({
      user,
      token,
    });

  } catch (err) {
    next(err);
  }
}


// ============================================================
// LOGIN
// POST /api/auth/login
// ============================================================

async function login(req, res, next) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const user = await UserModel.findByEmail(email);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    const token = signToken({
      userId: user.id,
    });

    delete user.password_hash;

    res.json({
      user,
      token,
    });

  } catch (err) {
    next(err);
  }
}


// ============================================================
// GET CURRENT USER
// GET /api/auth/me
// ============================================================

async function me(req, res, next) {
  try {
    const user = await UserModel.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    res.json({
      user,
    });

  } catch (err) {
    next(err);
  }
}


// ============================================================
// CHANGE PASSWORD WHILE LOGGED IN
// POST /api/auth/change-password
// ============================================================

async function changePassword(req, res, next) {
  try {
    const {
      currentPassword,
      newPassword,
    } = req.body;

    // -------------------------
    // Validate new password
    // -------------------------

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters',
      });
    }

    // -------------------------
    // Get current user
    // -------------------------

    const user = await UserModel.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // Need password hash
    const fullUser = await UserModel.findByEmail(user.email);

    // -------------------------
    // Verify current password
    // -------------------------

    const matches = await bcrypt.compare(
      currentPassword,
      fullUser.password_hash
    );

    if (!matches) {
      return res.status(401).json({
        error: 'Current password is incorrect',
      });
    }

    // -------------------------
    // Hash new password
    // -------------------------

    const newPasswordHash = await bcrypt.hash(
      newPassword,
      10
    );

    // -------------------------
    // Update password
    // -------------------------

    await query(
      `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      `,
      [
        newPasswordHash,
        req.userId,
      ]
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });

  } catch (err) {
    next(err);
  }
}


// ============================================================
// FORGOT PASSWORD - REQUEST OTP
// POST /api/auth/forgot-password/request
// ============================================================

async function requestForgotPassword(req, res, next) {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email address',
      });
    }

    const user = await UserModel.findByEmail(email);

    // Security:
    // Never reveal whether an account exists.
    if (!user) {
      return res.json({
        message:
          'If an account exists, a verification code has been sent',
      });
    }

    // -------------------------
    // Generate OTP
    // -------------------------

    const otp = generateOtp();

    const otpHash = await bcrypt.hash(
      otp,
      10
    );

    const otpExpiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // -------------------------
    // Remove old reset request
    // -------------------------

    await PasswordResetModel.deleteByEmail(email);

    // -------------------------
    // Save new reset request
    // -------------------------

    await PasswordResetModel.create({
      email,
      otpHash,
      otpExpiresAt,
    });

    // -------------------------
    // Send OTP
    // -------------------------

    await sendVerificationEmail(
      user.email,
      otp
    );

    res.json({
      message:
        'If an account exists, a verification code has been sent',
    });

  } catch (err) {
    next(err);
  }
}


// ============================================================
// FORGOT PASSWORD - VERIFY OTP
// POST /api/auth/forgot-password/verify
// ============================================================

async function verifyForgotPassword(req, res, next) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { code } = req.body;

    // -------------------------
    // Validate input
    // -------------------------

    if (!isValidEmail(email) || !code) {
      return res.status(400).json({
        error: 'Email and verification code are required',
      });
    }

    // -------------------------
    // Find user
    // -------------------------

    const user = await UserModel.findByEmail(email);

    if (!user) {
      return res.status(400).json({
        error: 'Invalid verification code',
      });
    }

    // -------------------------
    // Find reset request
    // -------------------------

    const resetRequest =
      await PasswordResetModel.findByEmail(email);

    if (!resetRequest) {
      return res.status(400).json({
        error: 'Invalid or expired verification code',
      });
    }

    // -------------------------
    // Check expiry
    // -------------------------

    if (
      new Date() >
      new Date(resetRequest.otp_expires_at)
    ) {
      await PasswordResetModel.deleteByEmail(email);

      return res.status(400).json({
        error: 'Verification code has expired',
      });
    }

    // -------------------------
    // Check attempts
    // -------------------------

    if (resetRequest.otp_attempts >= 5) {
      await PasswordResetModel.deleteByEmail(email);

      return res.status(429).json({
        error: 'Too many incorrect attempts',
      });
    }

    // -------------------------
    // Compare OTP
    // -------------------------

    const codeMatches = await bcrypt.compare(
      code,
      resetRequest.otp_hash
    );

    if (!codeMatches) {
      await PasswordResetModel.incrementAttempts(
        resetRequest.id
      );

      return res.status(400).json({
        error: 'Invalid verification code',
      });
    }

    // -------------------------
    // Create reset token
    // -------------------------

    const resetToken = signToken(
      {
        userId: user.id,
        purpose: 'password_reset',
      },
      '15m'
    );

    // -------------------------
    // Make OTP single-use
    // -------------------------

    await PasswordResetModel.deleteByEmail(email);

    res.json({
      message: 'Verification successful',
      resetToken,
    });

  } catch (err) {
    next(err);
  }
}


// ============================================================
// FORGOT PASSWORD - SET NEW PASSWORD
// POST /api/auth/forgot-password/reset
// ============================================================

async function confirmForgotPassword(req, res, next) {
  try {
    const {
      resetToken,
      newPassword,
    } = req.body;

    // -------------------------
    // Validate token
    // -------------------------

    if (!resetToken) {
      return res.status(400).json({
        error: 'Reset token is required',
      });
    }

    // -------------------------
    // Validate password
    // -------------------------

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters',
      });
    }

    let payload;

    // -------------------------
    // Verify reset token
    // -------------------------

    try {
      payload = verifyToken(resetToken);
    } catch (err) {
      return res.status(401).json({
        error: 'Reset token is invalid or expired',
      });
    }

    // -------------------------
    // Verify token purpose
    // -------------------------

    if (
      payload.purpose !== 'password_reset'
    ) {
      return res.status(401).json({
        error: 'Invalid password reset token',
      });
    }

    // -------------------------
    // Hash new password
    // -------------------------

    const newPasswordHash = await bcrypt.hash(
      newPassword,
      10
    );

    // -------------------------
    // Update password
    // -------------------------

    const result = await query(
      `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      `,
      [
        newPasswordHash,
        payload.userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'Password changed successfully',
    });

  } catch (err) {
    next(err);
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  registerRequest,
  verifyRegistration,

  login,
  me,

  changePassword,

  requestForgotPassword,
  verifyForgotPassword,
  confirmForgotPassword,
};