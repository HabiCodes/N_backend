const { query } = require('../config/db');

const CallModel = {
async create({ callerId, calleeId, conversationId, callType }) {
  const { rows } = await query(
    `INSERT INTO calls (caller_id, callee_id, conversation_id, call_type, status)
     VALUES ($1, $2, $3, $4, 'ringing') RETURNING id`,
    [callerId, calleeId, conversationId, callType]
  );
  return rows[0].id;
},

  async markStatus(callId, status) {
    await query(
      `UPDATE calls SET status = $1, ended_at = now() WHERE id = $2`,
      [status, callId]
    );
  },

  async listForUser(userId) {
    const { rows } = await query(
      `SELECT c.id, c.call_type, c.status, c.started_at,
              CASE WHEN c.caller_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
              other.id AS other_user_id, other.username AS other_username, other.avatar_url AS other_avatar_url
       FROM calls c
       JOIN users other ON other.id = CASE WHEN c.caller_id = $1 THEN c.callee_id ELSE c.caller_id END
       WHERE c.caller_id = $1 OR c.callee_id = $1
       ORDER BY c.started_at DESC
       LIMIT 100`,
      [userId]
    );
    return rows;
  },
};

module.exports = CallModel;