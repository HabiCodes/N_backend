const { query } = require('../config/db');

const PendingRegistrationModel = {
  async create({
    username,
    email,
    passwordHash,
    otpHash,
    otpExpiresAt,
  }) {
    const { rows } = await query(
      `INSERT INTO pending_registrations
       (username, email, password_hash, otp_hash, otp_expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, otp_expires_at, created_at`,
      [
        username,
        email,
        passwordHash,
        otpHash,
        otpExpiresAt,
      ]
    );

    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await query(
      `SELECT *
       FROM pending_registrations
       WHERE email = $1`,
      [email]
    );

    return rows[0] || null;
  },

  async deleteByEmail(email) {
    await query(
      `DELETE FROM pending_registrations
       WHERE email = $1`,
      [email]
    );
  },

  async incrementAttempts(id) {
    const { rows } = await query(
      `UPDATE pending_registrations
       SET otp_attempts = otp_attempts + 1
       WHERE id = $1
       RETURNING otp_attempts`,
      [id]
    );

    return rows[0];
  },
};

module.exports = PendingRegistrationModel;