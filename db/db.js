const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

const schemaPath = path.join(__dirname, 'schema.sql');
let initPromise = null;

async function initDb() {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
}

function ensureInit() {
  if (!initPromise) {
    initPromise = initDb().catch(err => {
      console.error('DB init error:', err.message);
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function get(sql, ...params) {
  const res = await pool.query(sql, params);
  return res.rows[0] || null;
}

async function all(sql, ...params) {
  const res = await pool.query(sql, params);
  return res.rows;
}

async function run(sql, ...params) {
  const res = await pool.query(sql, params);
  return { changes: res.rowCount, lastInsertRowid: res.rows?.[0]?.id ?? null };
}

module.exports = { ensureInit, get, all, run };
