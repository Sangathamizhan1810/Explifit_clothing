const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data.db');
let db = null;

async function initDb() {
  const SQL = await initSqlJs();

  // Load existing DB file if exists
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS designs (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age_group TEXT NOT NULL,
      contact_type TEXT,
      contact_value TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      design_id TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Seed designs from Images/ folder if table is empty
  const countResult = db.exec("SELECT COUNT(*) as c FROM designs");
  const count = countResult[0].values[0][0];

  if (count === 0) {
    const imagesDir = path.join(__dirname, '..', 'UI', 'public', 'assets', 'designs');
    if (!fs.existsSync(imagesDir)) {
      console.log('⚠️  Assets directory not found, skipping seed.');
    } else {
      const files = fs.readdirSync(imagesDir)
        .filter(f => /\.(jpeg|jpg|png|gif|webp)$/i.test(f))
        .sort();

      files.forEach((file, index) => {
        const id = `design_${String(index + 1).padStart(3, '0')}`;
        const name = `Design #${index + 1}`;
        const url = `/assets/designs/${encodeURIComponent(file)}`;
        db.run(
          'INSERT INTO designs (id, filename, name, url, active, priority) VALUES (?, ?, ?, ?, 1, ?)',
          [id, file, name, url, index + 1]
        );
      });
      console.log(`🌱 Seeded ${files.length} designs from assets folder.`);
    }
  }

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function getDb() {
  return db;
}

// Helper: run a query and return all rows as objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run a query and return first row as object
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run a statement (INSERT/UPDATE/DELETE)
function runSql(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

module.exports = { initDb, getDb, saveDb, queryAll, queryOne, runSql };
