const { query } = require('../config/db');

const MessageModel = {
  // ON CONFLICT handles a client retrying a send after a flaky connection -
  // returns the original row instead of creating a duplicate message.
  async create({ conversationId, senderId, content, clientMsgId, messageType = 'text' }) {
    const { rows } = await query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, client_msg_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (conversation_id, sender_id, client_msg_id) WHERE client_msg_id IS NOT NULL
       DO UPDATE SET content = messages.content
       RETURNING *`,
      [conversationId, senderId, content, messageType, clientMsgId || null]
    );
    return rows[0];
  },

  async listForConversation(conversationId, { limit = 50, before = null } = {}) {
    const params = [conversationId, limit];
    let cursorClause = '';
    if (before) {
      params.push(before);
      cursorClause = 'AND created_at < $3';
    }
    const { rows } = await query(
      `SELECT * FROM messages
       WHERE conversation_id = $1 ${cursorClause}
       ORDER BY created_at DESC
       LIMIT $2`,
      params
    );
    return rows.reverse(); // chronological order for the client
  },

  async markDelivered(messageIds) {
    if (!messageIds.length) return;
    await query(
      `UPDATE messages SET status = 'delivered' WHERE id = ANY($1::uuid[]) AND status = 'sent'`,
      [messageIds]
    );
  },

  async markReadUpTo(conversationId, readerId) {
    const { rows } = await query(
      `UPDATE messages SET status = 'read'
       WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'
       RETURNING id`,
      [conversationId, readerId]
    );
    return rows.map((r) => r.id);
  },
};

module.exports = MessageModel;
