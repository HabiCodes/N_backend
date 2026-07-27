const { isOnline } = require('./onlineUsers');
const CallModel = require('../models/callModel');
const UserModel = require('../models/userModel');
const ConversationModel = require('../models/conversationModel');

const RING_TIMEOUT_MS = 45 * 1000; // give up after 45s of no answer
const activeRingTimeouts = new Map(); // callId -> Timeout handle

function clearRingTimeout(callId) {
  const handle = activeRingTimeouts.get(callId);
  if (handle) {
    clearTimeout(handle);
    activeRingTimeouts.delete(callId);
  }
}

function registerCallHandlers(io, socket) {
  socket.on('call:invite', async ({ toUserId, conversationId, callType }, ack) => {
    try {
      if (!toUserId || toUserId === socket.userId) {
        return ack?.({ error: 'Invalid call target' });
      }

      // Make sure caller and callee actually share this conversation -
      // prevents calling arbitrary user ids.
      const allowed = await ConversationModel.isParticipant(conversationId, socket.userId);
      const calleeAllowed = await ConversationModel.isParticipant(conversationId, toUserId);
      if (!allowed || !calleeAllowed) {
        return ack?.({ error: 'Not a valid conversation for this call' });
      }

      const callId = await CallModel.create({
        callerId: socket.userId,
        calleeId: toUserId,
        conversationId,
        callType: callType || 'audio',
      });

      if (!isOnline(toUserId)) {
        await CallModel.markStatus(callId, 'missed');
        return ack?.({ error: 'User is offline', callId });
      }

      const caller = await UserModel.findById(socket.userId);

      io.to(toUserId).emit('call:incoming', {
        fromUserId: socket.userId,
        fromUsername: caller?.username || 'Unknown',
        conversationId,
        callType,
        callId,
      });

      // If nobody accepts/rejects within RING_TIMEOUT_MS, auto-mark missed
      // and tell the caller so their UI doesn't hang on "ringing" forever.
      const timeoutHandle = setTimeout(async () => {
        try {
          await CallModel.markStatus(callId, 'missed');
          io.to(socket.userId).emit('call:missed', { toUserId, conversationId, callId });
          io.to(toUserId).emit('call:missed', { fromUserId: socket.userId, conversationId, callId });
        } catch (err) {
          console.error('[call:invite] ring-timeout handling failed:', err.message);
        } finally {
          activeRingTimeouts.delete(callId);
        }
      }, RING_TIMEOUT_MS);

      activeRingTimeouts.set(callId, timeoutHandle);

      ack?.({ status: 'ringing', callId });
    } catch (err) {
      console.error('[call:invite] failed:', err.message);
      ack?.({ error: 'Failed to start call: ' + err.message });
    }
  });

  socket.on('call:accept', ({ toUserId, conversationId, callId }) => {
    try {
      if (callId) clearRingTimeout(callId);
      io.to(toUserId).emit('call:accepted', { fromUserId: socket.userId, conversationId, callId });
    } catch (err) {
      console.error('[call:accept] failed:', err.message);
    }
  });

  socket.on('call:reject', async ({ toUserId, conversationId, callId, reason }) => {
    try {
      if (callId) {
        clearRingTimeout(callId);
        await CallModel.markStatus(callId, 'rejected');
      }
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
      if (callId) {
        clearRingTimeout(callId);
        await CallModel.markStatus(callId, 'completed');
      }
      io.to(toUserId).emit('call:ended', { fromUserId: socket.userId, conversationId });
    } catch (err) {
      console.error('[call:end] failed:', err.message);
    }
  });
}

module.exports = { registerCallHandlers };