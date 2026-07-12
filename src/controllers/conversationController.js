const ConversationModel = require('../models/conversationModel');
const MessageModel = require('../models/messageModel');

async function listConversations(req, res, next) {
  try {
    const conversations = await ConversationModel.listForUser(req.userId);
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
}

// Starts (or fetches existing) a direct conversation with another user.
async function startConversation(req, res, next) {
  try {
    const { otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });
    if (otherUserId === req.userId) return res.status(400).json({ error: "Can't start a conversation with yourself" });

    const conversationId = await ConversationModel.getOrCreateDirectConversation(req.userId, otherUserId);
    res.json({ conversationId });
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const { conversationId } = req.params;
    const { before, limit } = req.query;

    const allowed = await ConversationModel.isParticipant(conversationId, req.userId);
    if (!allowed) return res.status(403).json({ error: 'Not a participant in this conversation' });

    const messages = await MessageModel.listForConversation(conversationId, {
      before: before || null,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

module.exports = { listConversations, startConversation, getMessages };
