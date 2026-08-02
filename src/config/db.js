const { Pool } = require('pg');

// Render's free Postgres requires SSL in production, not always locally.
// Set DB_SSL=false while testing offline against a local Postgres instance.
const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const writePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: 10, // Render free tier Postgres caps connections low - keep this conservative
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// If DATABASE_READ_URL isn't set (no replica provisioned yet), reads just
// use the same pool as writes — this is a safe no-op on current infra.
// The moment a read replica exists, set DATABASE_READ_URL and reads
// automatically route there with zero model-file changes.
const readPool = process.env.DATABASE_READ_URL
  ? new Pool({
      connectionString: process.env.DATABASE_READ_URL,
      ssl: sslConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : writePool;

writePool.on('error', (err) => console.error('[db:write] Unexpected error on idle client', err));
if (readPool !== writePool) {
  readPool.on('error', (err) => console.error('[db:read] Unexpected error on idle client', err));
}

async function query(text, params) {
  const start = Date.now();
  const res = await writePool.query(text, params);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[db:write]', text.split('\n')[0].trim(), `(${Date.now() - start}ms, ${res.rowCount} rows)`);
  }
  return res;
}

// Use for SELECT-only queries where slightly-stale replica data is fine
// (replica lag is typically sub-second, but is not guaranteed synchronous).
// Never use this for a read that must reflect a write from earlier in the
// same request (e.g. read-your-own-write flows) — use query() for those.
async function readQuery(text, params) {
  const start = Date.now();
  const res = await readPool.query(text, params);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[db:read]', text.split('\n')[0].trim(), `(${Date.now() - start}ms, ${res.rowCount} rows)`);
  }
  return res;
}

module.exports = { pool: writePool, writePool, readPool, query, readQuery };