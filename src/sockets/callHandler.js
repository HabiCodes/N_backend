const { isOnline } = require('./onlineUsers');
const CallModel = require('../models/callModel');

function registerCallHandlers(io, socket) {
  socket.on('call:invite', async ({ toUserId, conversationId, callType }, ack) => {
    try {
      if (!isOnline(toUserId)) {
        return ack?.({ error: 'User is offline' });
      }
      const callId = await CallModel.create({
        callerId: socket.userId,
        calleeId: toUserId,
        conversationId,
        callType: callType || 'audio',
      });
      io.to(toUserId).emit('call:incoming', {
        fromUserId: socket.userId,
        conversationId,
        callType,
        callId,
      });
      ack?.({ status: 'ringing', callId });
    } catch (err) {
      console.error('[call:invite] failed:', err.message);
      ack?.({ error: 'Failed to start call: ' + err.message });
    }
  });

  socket.on('call:accept', ({ toUserId, conversationId, callId }) => {
    try {
      io.to(toUserId).emit('call:accepted', { fromUserId: socket.userId, conversationId, callId });
    } catch (err) {
      console.error('[call:accept] failed:', err.message);
    }
  });

  socket.on('call:reject', async ({ toUserId, conversationId, callId, reason }) => {
    try {
      if (callId) await CallModel.markStatus(callId, 'rejected');
      io.to(toUserId).emit('call:rejected', { fromUserId: socket.userId, conversationId, reason: reason || 'declined' });
    } catch (err) {
      console.error('[call:reject] failed:', err.message);
    }
  });

  socket.on('call:offer', ({ toUserId, sdp }) => {
    io.to(toUserId).emit('call:offer', { fromUserId: socket.userId, sdp });
  });

  socket.on('call:answer', ({ toUserId, sdp }) => {
    io.to(toUserId).emit('call:answer', { fromUserId: socket.userId, sdp });
  });

  socket.on('call:ice-candidate', ({ toUserId, candidate }) => {
    io.to(toUserId).emit('call:ice-candidate', { fromUserId: socket.userId, candidate });
  });

  socket.on('call:end', async ({ toUserId, conversationId, callId }) => {
    try {
      if (callId) await CallModel.markStatus(callId, 'completed');
      io.to(toUserId).emit('call:ended', { fromUserId: socket.userId, conversationId });
    } catch (err) {
      console.error('[call:end] failed:', err.message);
    }
  });
}

module.exports = { registerCallHandlers };