const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'vault.db');
const db = new Database(dbPath);

// Enable WAL mode & foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize Tables
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      username TEXT,
      pin_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'folder',
      is_private INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      folder_id INTEGER DEFAULT NULL,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT DEFAULT 'application/octet-stream',
      category TEXT DEFAULT 'document',
      telegram_file_id TEXT DEFAULT NULL,
      telegram_message_id TEXT DEFAULT NULL,
      local_path TEXT DEFAULT NULL,
      is_starred INTEGER DEFAULT 0,
      is_private INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  try {
    db.exec(`ALTER TABLE files ADD COLUMN local_path TEXT DEFAULT NULL;`);
  } catch (e) {
    // Column already exists
  }

  // Purge all legacy demo files and folders for clean slate
  db.exec(`
    DELETE FROM files;
    DELETE FROM folders;
  `);

  // Seed default settings if empty
  const hasSettings = db.prepare('SELECT COUNT(*) as count FROM settings').get().count > 0;
  if (!hasSettings) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('app_name', '✦ TELEGRAM VAULT');
    insertSetting.run('storage_limit_bytes', String(10 * 1024 * 1024 * 1024)); // 10 GB limit
    insertSetting.run('accent_color', '#3b82f6');
  }
}

// Run DB Initialization
initDatabase();

module.exports = db;
