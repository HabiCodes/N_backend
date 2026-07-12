// ============================================================
// WebRTC signaling over the existing Socket.io connection.
//
// IMPORTANT CONCEPT: Socket.io/your server NEVER carries the actual
// audio/video. It only relays small text messages (SDP offers/answers
// and ICE candidates) so two browsers can find each other and agree
// on how to open a DIRECT peer-to-peer media connection between them.
// Once that P2P connection is up, video/audio bytes flow browser-to-
// browser (or through a TURN relay if a direct path isn't possible),
// completely bypassing your server. That's why WebRTC calling is
// cheap to run even on a free-tier backend - you're never touching
// the actual media stream.
//
// Call flow:
//   1. Caller emits "call:invite" -> callee gets "call:incoming"
//   2. Callee emits "call:accept" or "call:reject"
//   3. If accepted, both sides exchange "call:offer" / "call:answer" (SDP)
//   4. Both sides continuously exchange "call:ice-candidate" as they're discovered
//   5. Either side emits "call:end" to hang up
// ============================================================

const { isOnline } = require('./onlineUsers');

function registerCallHandlers(io, socket) {
  // { toUserId, conversationId, callType: 'audio' | 'video' }
  socket.on('call:invite', ({ toUserId, conversationId, callType }, ack) => {
    if (!isOnline(toUserId)) {
      return ack?.({ error: 'User is offline' });
    }
    io.to(toUserId).emit('call:incoming', {
      fromUserId: socket.userId,
      conversationId,
      callType,
    });
    ack?.({ status: 'ringing' });
  });

  socket.on('call:accept', ({ toUserId, conversationId }) => {
    io.to(toUserId).emit('call:accepted', { fromUserId: socket.userId, conversationId });
  });

  socket.on('call:reject', ({ toUserId, conversationId, reason }) => {
    io.to(toUserId).emit('call:rejected', { fromUserId: socket.userId, conversationId, reason: reason || 'declined' });
  });

  // SDP offer/answer - just relay the payload verbatim to the other peer
  socket.on('call:offer', ({ toUserId, sdp }) => {
    io.to(toUserId).emit('call:offer', { fromUserId: socket.userId, sdp });
  });

  socket.on('call:answer', ({ toUserId, sdp }) => {
    io.to(toUserId).emit('call:answer', { fromUserId: socket.userId, sdp });
  });

  // ICE candidates trickle in one at a time as each browser discovers
  // possible network paths - relay each one immediately, don't batch them
  socket.on('call:ice-candidate', ({ toUserId, candidate }) => {
    io.to(toUserId).emit('call:ice-candidate', { fromUserId: socket.userId, candidate });
  });

  socket.on('call:end', ({ toUserId, conversationId }) => {
    io.to(toUserId).emit('call:ended', { fromUserId: socket.userId, conversationId });
  });
}

module.exports = { registerCallHandlers };
