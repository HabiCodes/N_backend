const ConversationModel = require('../models/conversationModel');
const MessageModel = require('../models/messageModel');
const { getSocketIds } = require('./onlineUsers');

// Room naming convention: every user joins a room named after their own id.
// This means "send to user X" is just io.to(X).emit(...) - no need to track
// individual socket ids for messaging (only presence needs that).
function registerChatHandlers(io, socket) {
  socket.join(socket.userId);

  // Client sends: { conversationId, content, clientMsgId }
  socket.on('message:send', async (payload, ack) => {
    try {
      const { conversationId, content, clientMsgId } = payload;

      if (!conversationId || !content?.trim()) {
        return ack?.({ error: 'conversationId and content are required' });
      }

      const allowed = await ConversationModel.isParticipant(conversationId, socket.userId);
      if (!allowed) return ack?.({ error: 'Not a participant in this conversation' });

      const message = await MessageModel.create({
        conversationId,
        senderId: socket.userId,
        content: content.trim(),
        clientMsgId,
      });

      // Acknowledge the sender immediately (their UI can stop showing "sending...")
      ack?.({ message });

      // Deliver to everyone else in the conversation who's currently connected
      const recipientIds = await ConversationModel.getOtherParticipantIds(conversationId, socket.userId);
      recipientIds.forEach((userId) => {
        io.to(userId).emit('message:new', { message });
      });
    } catch (err) {
      console.error('[socket] message:send failed', err);
      ack?.({ error: 'Failed to send message' });
    }
  });

  // Client sends: { conversationId } when the other user's messages are visible on screen
  socket.on('message:read', async ({ conversationId }) => {
    try {
      const readIds = await MessageModel.markReadUpTo(conversationId, socket.userId);
      if (!readIds.length) return;

      const otherIds = await ConversationModel.getOtherParticipantIds(conversationId, socket.userId);
      otherIds.forEach((userId) => {
        io.to(userId).emit('message:read', { conversationId, messageIds: readIds });
      });
    } catch (err) {
      console.error('[socket] message:read failed', err);
    }
  });

  // Typing indicator - fire-and-forget, no DB write
  socket.on('typing:start', async ({ conversationId }) => {
    const otherIds = await ConversationModel.getOtherParticipantIds(conversationId, socket.userId);
    otherIds.forEach((userId) => io.to(userId).emit('typing:start', { conversationId, userId: socket.userId }));
  });

  socket.on('typing:stop', async ({ conversationId }) => {
    const otherIds = await ConversationModel.getOtherParticipantIds(conversationId, socket.userId);
    otherIds.forEach((userId) => io.to(userId).emit('typing:stop', { conversationId, userId: socket.userId }));
  });
}

module.exports = { registerChatHandlers };
