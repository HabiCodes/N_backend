const { query } = require('../config/db');

const PasswordResetModel = {
  async create({ email, otpHash, otpExpiresAt }) {
    const { rows } = await query(
      `INSERT INTO password_reset_requests
       (email, otp_hash, otp_expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, email, otp_expires_at, created_at`,
      [email, otpHash, otpExpiresAt]
    );
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await query(
      `SELECT * FROM password_reset_requests WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  async deleteByEmail(email) {
    await query(`DELETE FROM password_reset_requests WHERE email = $1`, [email]);
  },

  async incrementAttempts(id) {
    const { rows } = await query(
      `UPDATE password_reset_requests
       SET otp_attempts = otp_attempts + 1
       WHERE id = $1
       RETURNING otp_attempts`,
      [id]
    );
    return rows[0];
  },
};

module.exports = PasswordResetModel;