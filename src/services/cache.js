// src/services/cache.js
const { dataClient } = require('../config/redis');

const DEFAULT_TTL_SECONDS = 30;

// Cache-aside helper: try Redis first, fall back to the provided loader
// function on a miss, and populate the cache for next time.
// Deliberately short TTL (30s default) rather than manual invalidation
// for every write path — for a chat app's conversation list, "up to 30s
// stale" is an acceptable tradeoff against the complexity of invalidating
// correctly across every message-send code path (REST + socket).
async function getOrSet(key, ttlSeconds, loader) {
  try {
    const cached = await dataClient.get(key);
    if (cached !== null) return JSON.parse(cached);
  } catch (err) {
    // Redis miss/error should never break the app — fall through to the DB.
    console.error('[cache] read failed, falling back to source:', err.message);
  }

  const fresh = await loader();

  try {
    await dataClient.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
  } catch (err) {
    console.error('[cache] write failed (non-fatal):', err.message);
  }

  return fresh;
}

// Explicit invalidation for paths where 30s staleness is too slow — e.g.
// call this right after a message send so the sender's own next
// conversation-list fetch isn't stale for their own action.
async function invalidate(key) {
  try {
    await dataClient.del(key);
  } catch (err) {
    console.error('[cache] invalidate failed (non-fatal):', err.message);
  }
}

module.exports = { getOrSet, invalidate, DEFAULT_TTL_SECONDS };