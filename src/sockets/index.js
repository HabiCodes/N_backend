const { socketAuthMiddleware } = require('./socketAuth');
const { registerChatHandlers } = require('./chatHandler');
const { registerCallHandlers } = require('./callHandler');
const { addSocket, removeSocket } = require('./onlineUsers');
const UserModel = require('../models/userModel');

function initSockets(io) {
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    const { userId } = socket;
    console.log(`[socket] connected: user=${userId} socket=${socket.id}`);

    const isFirstConnection = addSocket(userId, socket.id);
    if (isFirstConnection) {
      await UserModel.setOnlineStatus(userId, true);
      socket.broadcast.emit('presence:online', { userId });
    }

    registerChatHandlers(io, socket);
    registerCallHandlers(io, socket);

    socket.on('disconnect', async () => {
      console.log(`[socket] disconnected: user=${userId} socket=${socket.id}`);
      const isFullyOffline = removeSocket(userId, socket.id);
      if (isFullyOffline) {
        await UserModel.setOnlineStatus(userId, false);
        socket.broadcast.emit('presence:offline', { userId });
      }
    });
  });
}

module.exports = { initSockets };
