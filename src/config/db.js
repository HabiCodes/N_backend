const { Pool } = require('pg');

// Render's free Postgres requires SSL in production, not always locally.
// Set DB_SSL=false while testing offline against a local Postgres instance.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10, // Render free tier Postgres caps connections low - keep this conservative
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[db]', text.split('\n')[0].trim(), `(${Date.now() - start}ms, ${res.rowCount} rows)`);
  }
  return res;
}

module.exports = { pool, query };
