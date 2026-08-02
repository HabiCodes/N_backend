// src/sockets/onlineUsers.js
const crypto = require('crypto');
const { dataClient } = require('../config/redis');

// Unique per process — lets us namespace socket entries so two instances
// can never accidentally clash or overwrite each other's presence data.
const INSTANCE_ID = crypto.randomUUID();

function memberKey(socketId) {
  return `${INSTANCE_ID}:${socketId}`;
}

function presenceKey(userId) {
  return `presence:user:${userId}`;
}

// Returns true if this is the user's first connection (any instance,
// determined by set cardinality after the add).
async function addSocket(userId, socketId) {
  const key = presenceKey(userId);
  const wasEmpty = (await dataClient.scard(key)) === 0;
  await dataClient.sadd(key, memberKey(socketId));
  return wasEmpty;
}

// Returns true if the user now has zero connections across the whole cluster.
async function removeSocket(userId, socketId) {
  const key = presenceKey(userId);
  await dataClient.srem(key, memberKey(socketId));
  const remaining = await dataClient.scard(key);
  if (remaining === 0) {
    await dataClient.del(key); // tidy up empty sets rather than leaving them around
    return true;
  }
  return false;
}

async function isOnline(userId) {
  return (await dataClient.scard(presenceKey(userId))) > 0;
}

// Not cluster-resolvable to a specific "this instance's socket ids" the way
// the old in-memory version was — callers needing actual socket delivery
// should use io.to(userId).emit(...) via the room join instead, which
// works correctly across the adapter. This is kept for parity/debugging.
async function getPresenceEntries(userId) {
  return dataClient.smembers(presenceKey(userId));
}

// Crash-safety sweep: if an instance dies without running its disconnect
// handlers, its entries linger in Redis forever. Call this on process
// startup to clear out any stale entries tagged with THIS instance's old
// runs — safe because a fresh process boot means all of last run's
// sockets are definitely gone.
async function cleanupStaleEntriesOnBoot() {
  // Deliberately left as a no-op placeholder for now — a full sweep needs
  // to scan all presence:user:* keys, which is a Phase 8 (chaos/failover
  // hardening) concern, not needed for correctness at Phase 2 scale.
  // See Phase 8 notes for the SCAN-based implementation.
}

module.exports = {
  addSocket,
  removeSocket,
  isOnline,
  getPresenceEntries,
  cleanupStaleEntriesOnBoot,
  INSTANCE_ID,
};