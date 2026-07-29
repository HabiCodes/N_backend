const { isOnline } = require('./onlineUsers');
const { sendCallPushNotification } = require('../services/pushNotifications');
const CallModel = require('../models/callModel');
const UserModel = require('../models/userModel');
const ConversationModel = require('../models/conversationModel');

const RING_TIMEOUT_MS = 45 * 1000;
const activeRingTimeouts = new Map();
const activeCalls = new Map();

function clearRingTimeout(callId) {
  const handle = activeRingTimeouts.get(callId);
  if (handle) {
    clearTimeout(handle);
    activeRingTimeouts.delete(callId);
  }
}

function isParticipant(call, userId) {
  return !!call && (call.callerId === userId || call.calleeId === userId);
}

function registerCallHandlers(io, socket) {
  socket.on('call:invite', async ({ toUserId, conversationId, callType }, ack) => {
    try {
      if (!toUserId || toUserId === socket.userId) {
        return ack?.({ error: 'Invalid call target' });
      }

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

      activeCalls.set(callId, { callerId: socket.userId, calleeId: toUserId });

      const caller = await UserModel.findById(socket.userId);

      if (isOnline(toUserId)) {
        // Callee has a live socket — signal them directly.
        io.to(toUserId).emit('call:incoming', {
          fromUserId: socket.userId,
          fromUsername: caller?.username || 'Unknown',
          conversationId,
          callType,
          callId,
        });
      } else {
        // Callee is offline — try to wake their device via push instead.
        const callee = await UserModel.findById(toUserId);

        const pushSent = callee?.fcm_token
          ? await sendCallPushNotification(callee.fcm_token, {
              fromUserId: socket.userId,
              fromUsername: caller?.username || 'Unknown',
              callId,
              conversationId,
              callType: callType || 'audio',
            })
          : false;

        if (!pushSent) {
          await CallModel.markStatus(callId, 'missed');
          activeCalls.delete(callId);
          return ack?.({ error: 'User unreachable', callId });
        }
        // Push sent — fall through to the shared ring-timeout logic below,
        // same as the online case. If the callee's app wakes up, reconnects
        // its socket, and accepts/rejects within RING_TIMEOUT_MS, the normal
        // call:accept / call:reject handlers take it from here.
      }

      // Single shared timeout + single ack, for BOTH the online and
      // push-woken paths.
      const timeoutHandle = setTimeout(async () => {
        try {
          await CallModel.markStatus(callId, 'missed');
          io.to(socket.userId).emit('call:missed', { toUserId, conversationId, callId });
          io.to(toUserId).emit('call:missed', { fromUserId: socket.userId, conversationId, callId });
        } catch (err) {
          console.error('[call:invite] ring-timeout handling failed:', err.message);
        } finally {
          activeRingTimeouts.delete(callId);
          activeCalls.delete(callId);
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
      const call = activeCalls.get(callId);
      if (!isParticipant(call, socket.userId) || !isParticipant(call, toUserId)) return;

      if (callId) clearRingTimeout(callId);
      io.to(toUserId).emit('call:accepted', { fromUserId: socket.userId, conversationId, callId });
    } catch (err) {
      console.error('[call:accept] failed:', err.message);
    }
  });

  socket.on('call:reject', async ({ toUserId, conversationId, callId, reason }) => {
    try {
      const call = activeCalls.get(callId);
      if (!isParticipant(call, socket.userId) || !isParticipant(call, toUserId)) return;

      if (callId) {
        clearRingTimeout(callId);
        await CallModel.markStatus(callId, 'rejected');
        activeCalls.delete(callId);
      }
      io.to(toUserId).emit('call:rejected', { fromUserId: socket.userId, conversationId, reason: reason || 'declined' });
    } catch (err) {
      console.error('[call:reject] failed:', err.message);
    }
  });

  socket.on('call:offer', ({ toUserId, callId, sdp }) => {
    const call = activeCalls.get(callId);
    if (!isParticipant(call, socket.userId) || !isParticipant(call, toUserId)) return;
    io.to(toUserId).emit('call:offer', { fromUserId: socket.userId, callId, sdp });
  });

  socket.on('call:answer', ({ toUserId, callId, sdp }) => {
    const call = activeCalls.get(callId);
    if (!isParticipant(call, socket.userId) || !isParticipant(call, toUserId)) return;
    io.to(toUserId).emit('call:answer', { fromUserId: socket.userId, callId, sdp });
  });

  socket.on('call:ice-candidate', ({ toUserId, callId, candidate }) => {
    const call = activeCalls.get(callId);
    if (!isParticipant(call, socket.userId) || !isParticipant(call, toUserId)) return;
    io.to(toUserId).emit('call:ice-candidate', { fromUserId: socket.userId, callId, candidate });
  });

  socket.on('call:end', async ({ toUserId, conversationId, callId }) => {
    try {
      if (callId) {
        clearRingTimeout(callId);
        await CallModel.markStatus(callId, 'completed');
        activeCalls.delete(callId);
      }
      io.to(toUserId).emit('call:ended', { fromUserId: socket.userId, conversationId });
    } catch (err) {
      console.error('[call:end] failed:', err.message);
    }
  });
}

module.exports = { registerCallHandlers };