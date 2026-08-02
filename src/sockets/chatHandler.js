const ConversationModel = require('../models/conversationModel');
const MessageModel = require('../models/messageModel');
const UserModel = require('../models/userModel');                          // add this
const { isOnline } = require('./onlineUsers');                             // add this
const { sendMessagePushNotification } = require('../services/pushNotifications'); // add this

function registerChatHandlers(io, socket) {
  socket.join(socket.userId);

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

      ack?.({ message });

      const sender = await UserModel.findById(socket.userId);
      const recipientIds = await ConversationModel.getOtherParticipantIds(conversationId, socket.userId);

      for (const userId of recipientIds) {
        if (await isOnline(userId)) {
          // Live socket — deliver in real time, same as before.
          io.to(userId).emit('message:new', { message });
        } else {
          // Offline — wake them with a push, same fallback pattern as calls.
          const recipient = await UserModel.findById(userId);
          if (recipient?.fcm_token) {
            await sendMessagePushNotification(recipient.fcm_token, {
              fromUserId: socket.userId,
              fromUsername: sender?.username || 'Someone',
              conversationId,
              preview: content.trim(),
            });
          }
        }
      }
    } catch (err) {
      console.error('[socket] message:send failed', err);
      ack?.({ error: 'Failed to send message' });
    }
  });

  // ...rest of the file (message:read, typing:start, typing:stop) stays exactly as-is

  // Client sends: { conversationId } when the other user's messages are visible on screen
socket.on('message:read', async ({ conversationId }) => {
    try {
      if (!conversationId) return;
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

  socket.on('typing:start', async ({ conversationId }) => {
    try {
      if (!conversationId) return;
      const otherIds = await ConversationModel.getOtherParticipantIds(conversationId, socket.userId);
      otherIds.forEach((userId) => io.to(userId).emit('typing:start', { conversationId, userId: socket.userId }));
    } catch (err) {
      console.error('[socket] typing:start failed', err);
    }
  });

  socket.on('typing:stop', async ({ conversationId }) => {
    try {
      if (!conversationId) return;
      const otherIds = await ConversationModel.getOtherParticipantIds(conversationId, socket.userId);
      otherIds.forEach((userId) => io.to(userId).emit('typing:stop', { conversationId, userId: socket.userId }));
    } catch (err) {
      console.error('[socket] typing:stop failed', err);
    }
  });
}

module.exports = { registerChatHandlers };
