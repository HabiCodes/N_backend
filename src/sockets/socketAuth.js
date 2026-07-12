const { verifyToken } = require('../utils/jwt');

// Socket.io middleware: client must connect with { auth: { token } }
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = verifyToken(token);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
}

module.exports = { socketAuthMiddleware };
