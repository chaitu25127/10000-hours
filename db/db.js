const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data.db');
const schemaPath = path.join(__dirname, 'schema.sql');
let db = null;

function exec(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function get(sql, ...params) {
  const rows = exec(sql, params);
  return rows[0] || null;
}

function all(sql, ...params) {
  return exec(sql, params);
}

function run(sql, ...params) {
  db.run(sql, params);
  return { changes: db.getRowsModified(), lastInsertRowid: Number(db.exec("SELECT last_insert_rowid() as id")[0].values[0][0]) };
}

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.run(schema);
  saveDb();
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

module.exports = { initDb, get, all, run, saveDb };
