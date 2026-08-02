// src/config/redis.js
const Redis = require('ioredis');

// Render/most hosts give you one REDIS_URL. If you're running Redis
// locally for dev and haven't set it, this defaults to localhost.
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

function createClient(name) {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // required by socket.io-redis-adapter for pub/sub clients
    enableReadyCheck: true,
  });

  client.on('error', (err) => console.error(`[redis:${name}] error`, err.message));
  client.on('connect', () => console.log(`[redis:${name}] connected`));
  client.on('reconnecting', () => console.warn(`[redis:${name}] reconnecting...`));

  return client;
}

// Separate clients: socket.io-redis-adapter takes exclusive ownership of
// pubClient/subClient for its own pub/sub traffic. Using the same client
// for presence commands would conflict with that.
const pubClient = createClient('pub');
const subClient = pubClient.duplicate();
const dataClient = createClient('data'); // general-purpose: presence, call state

subClient.on('error', (err) => console.error('[redis:sub] error', err.message));

module.exports = { pubClient, subClient, dataClient };