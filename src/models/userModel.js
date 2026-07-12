const { query } = require('../config/db');

const UserModel = {
  async create({ username, email, passwordHash }) {
    const { rows } = await query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, avatar_url, created_at`,
      [username, email, passwordHash]
    );
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT id, username, email, avatar_url, is_online, last_seen_at, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async searchByUsername(fragment, excludeUserId) {
    const { rows } = await query(
      `SELECT id, username, email, avatar_url, is_online
       FROM users
       WHERE username ILIKE $1 AND id != $2
       LIMIT 20`,
      [`%${fragment}%`, excludeUserId]
    );
    return rows;
  },

  async setOnlineStatus(userId, isOnline) {
    await query(`UPDATE users SET is_online = $1, last_seen_at = now() WHERE id = $2`, [isOnline, userId]);
  },
};

module.exports = UserModel;
