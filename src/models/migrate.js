// Run with: npm run migrate
const fs = require('fs');
const path = require('path');
require('../config/env'); // validates env vars early
const { pool } = require('../config/db');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[migrate] Applying schema.sql ...');
  try {
    await pool.query(sql);
    console.log('[migrate] Done. Tables are ready.');
  } catch (err) {
    console.error('[migrate] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
