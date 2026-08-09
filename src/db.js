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

  // Seed default settings if empty
  const hasSettings = db.prepare('SELECT COUNT(*) as count FROM settings').get().count > 0;
  if (!hasSettings) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('app_name', '✦ TELEGRAM VAULT');
    insertSetting.run('storage_limit_bytes', String(10 * 1024 * 1024 * 1024)); // 10 GB limit
    insertSetting.run('accent_color', '#6366f1');
    insertSetting.run('require_pin', '0');
  }

  // Seed sample data for default user if empty
  const defaultUserId = 'arasu_default';
  const hasFolders = db.prepare('SELECT COUNT(*) as count FROM folders WHERE user_id = ?').get(defaultUserId).count > 0;
  
  if (!hasFolders) {
    seedDefaultVault(defaultUserId);
  }
}

function seedDefaultVault(userId) {
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, first_name, username) VALUES (?, ?, ?)');
  insertUser.run(userId, 'Arasu', 'arasu');

  const insertFolder = db.prepare(`
    INSERT INTO folders (user_id, parent_id, name, icon, is_private, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertFile = db.prepare(`
    INSERT INTO files (user_id, folder_id, name, size, mime_type, category, telegram_file_id, is_starred, is_private, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000).toISOString();
  const tenMinsAgo = new Date(now.getTime() - 600000).toISOString();
  const lastWeek = new Date(now.getTime() - 7 * 86400000).toISOString();

  // Root Folders
  const docFolder = insertFolder.run(userId, null, 'Documents', 'file-text', 0, lastWeek).lastInsertRowid;
  const projectFolder = insertFolder.run(userId, null, 'Projects', 'briefcase', 0, lastWeek).lastInsertRowid;
  const photoFolder = insertFolder.run(userId, null, 'Photos', 'image', 0, lastWeek).lastInsertRowid;
  const videoFolder = insertFolder.run(userId, null, 'Videos', 'video', 0, lastWeek).lastInsertRowid;
  const certFolder = insertFolder.run(userId, null, 'Certificates', 'award', 1, lastWeek).lastInsertRowid; // Private

  // Subfolders under Documents
  const collegeDocFolder = insertFolder.run(userId, docFolder, 'College', 'graduation-cap', 0, lastWeek).lastInsertRowid;
  const hclFolder = insertFolder.run(userId, docFolder, 'HCL', 'building', 0, lastWeek).lastInsertRowid;

  // Subfolders under Photos
  const collegePhotoFolder = insertFolder.run(userId, photoFolder, 'College', 'camera', 0, lastWeek).lastInsertRowid;
  const personalPhotoFolder = insertFolder.run(userId, photoFolder, 'Personal', 'user', 0, lastWeek).lastInsertRowid;

  // Root level sample files
  insertFile.run(userId, null, 'Resume.pdf', 2516582, 'application/pdf', 'document', 'demo_file_id_resume', 1, 0, tenMinsAgo);
  insertFile.run(userId, null, 'Project Report.xlsx', 5033164, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'excel', 'demo_file_id_project', 1, 0, yesterday);
  insertFile.run(userId, null, 'Passport_Scan.pdf', 3145728, 'application/pdf', 'document', 'demo_file_id_passport', 0, 1, lastWeek);

  // Files in College Documents
  insertFile.run(userId, collegeDocFolder, 'Marksheet.pdf', 1258291, 'application/pdf', 'document', 'demo_file_id_marksheet', 1, 0, lastWeek);
  insertFile.run(userId, collegeDocFolder, 'Degree_Certificate.pdf', 4194304, 'application/pdf', 'document', 'demo_file_id_degree', 1, 0, lastWeek);

  // Files in HCL
  insertFile.run(userId, hclFolder, 'Offer Letter.pdf', 2097152, 'application/pdf', 'document', 'demo_file_id_offer', 0, 0, yesterday);
  insertFile.run(userId, hclFolder, 'Joining Documents.pdf', 8388608, 'application/pdf', 'document', 'demo_file_id_joining', 0, 0, lastWeek);

  // Files in Projects
  insertFile.run(userId, projectFolder, 'Q3_Financial_Analysis.xlsx', 6291456, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'excel', 'demo_file_id_q3', 0, 0, tenMinsAgo);
  insertFile.run(userId, projectFolder, 'System_Architecture_2026.pdf', 7340032, 'application/pdf', 'document', 'demo_file_id_arch', 1, 0, yesterday);

  // Files in Photos
  insertFile.run(userId, collegePhotoFolder, 'Convocation_Group.jpg', 4718592, 'image/jpeg', 'photo', 'demo_file_id_convocation', 0, 0, lastWeek);
  insertFile.run(userId, personalPhotoFolder, 'Vacation_2026.png', 3670016, 'image/png', 'photo', 'demo_file_id_vacation', 0, 0, yesterday);

  // Files in Videos
  insertFile.run(userId, videoFolder, 'Product_Demo_HD.mp4', 47185920, 'video/mp4', 'video', 'demo_file_id_demo_video', 0, 0, lastWeek);
}

// Run DB Initialization
initDatabase();

module.exports = db;
