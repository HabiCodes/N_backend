const { query, readQuery, pool } = require('../config/db');
const cache = require('../services/cache');

const ConversationModel = {
  async findDirectConversation(userIdA, userIdB) {
    const { rows } = await query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = $1
       JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = $2
       WHERE c.is_group = false
       LIMIT 1`,
      [userIdA, userIdB]
    );
    return rows[0] || null;
  },

  // Wrapped in a transaction so two rapid concurrent requests can't create duplicate conversations.
  async createDirectConversation(userIdA, userIdB) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const convResult = await client.query(`INSERT INTO conversations (is_group) VALUES (false) RETURNING id`);
      const conversationId = convResult.rows[0].id;

      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
        [conversationId, userIdA, userIdB]
      );

      await client.query('COMMIT');
      return conversationId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getOrCreateDirectConversation(userIdA, userIdB) {
    const existing = await this.findDirectConversation(userIdA, userIdB);
    if (existing) return existing.id;
    return this.createDirectConversation(userIdA, userIdB);
  },

async listForUser(userId) {
    return cache.getOrSet(`conversations:list:${userId}`, 30, async () => {
      const { rows } = await readQuery(
        `SELECT
           c.id AS conversation_id,
           c.is_group,
           c.name,
           other.id AS other_user_id,
           other.username AS other_username,
           other.avatar_url AS other_avatar_url,
           other.is_online AS other_is_online,
           lm.content AS last_message_content,
           lm.created_at AS last_message_at
         FROM conversations c
         JOIN conversation_participants me ON me.conversation_id = c.id AND me.user_id = $1
         LEFT JOIN conversation_participants op ON op.conversation_id = c.id AND op.user_id != $1
         LEFT JOIN users other ON other.id = op.user_id
         LEFT JOIN LATERAL (
           SELECT content, created_at FROM messages
           WHERE conversation_id = c.id
           ORDER BY created_at DESC LIMIT 1
         ) lm ON true
         ORDER BY lm.created_at DESC NULLS LAST`,
        [userId]
      );
      return rows;
    });
  },

  async isParticipant(conversationId, userId) {
    const { rows } = await query(
      `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
    return rows.length > 0;
  },

  async getOtherParticipantIds(conversationId, excludeUserId) {
    const { rows } = await query(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2`,
      [conversationId, excludeUserId]
    );
    return rows.map((r) => r.user_id);
  },
};

module.exports = ConversationModel;
