// In-memory map of userId -> Set of socket ids.
// A user can have multiple sockets open (two tabs/devices), so we track a Set,
// not a single id, and only mark them "offline" once every socket disconnects.
// NOTE: this lives in process memory. Fine for a single Render instance;
// if you ever scale to multiple instances you'd move this to Redis.
const onlineUsers = new Map();

function addSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
  return onlineUsers.get(userId).size === 1; // true if this is their first connection
}

function removeSocket(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return true;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true; // true if they have no more connections left (now fully offline)
  }
  return false;
}

function isOnline(userId) {
  return onlineUsers.has(userId);
}

function getSocketIds(userId) {
  return Array.from(onlineUsers.get(userId) || []);
}

module.exports = { addSocket, removeSocket, isOnline, getSocketIds };
