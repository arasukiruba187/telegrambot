require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('./db');
const { sendVaultFileToChat } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max per file

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const DEFAULT_USER_ID = 'arasu_default';

/**
 * Utility: Helper to build breadcrumbs path
 */
function getBreadcrumbs(folderId, userId = DEFAULT_USER_ID) {
  const crumbs = [{ id: null, name: 'My Vault' }];
  let currentId = folderId ? Number(folderId) : null;

  while (currentId) {
    const folder = db.prepare('SELECT id, parent_id, name FROM folders WHERE id = ? AND user_id = ?').get(currentId, userId);
    if (!folder) break;
    crumbs.splice(1, 0, { id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }
  return crumbs;
}

/**
 * 1. Vault Overview Statistics
 */
app.get('/api/vault', (req, res) => {
  try {
    const userId = req.query.user_id || DEFAULT_USER_ID;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || { first_name: 'Arasu', username: 'arasu' };

    const totalUsed = db.prepare('SELECT SUM(size) as total FROM files WHERE user_id = ?').get(userId).total || 0;
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM files WHERE user_id = ?').get(userId).count;
    const folderCount = db.prepare('SELECT COUNT(*) as count FROM folders WHERE user_id = ?').get(userId).count;

    const limitSetting = db.prepare("SELECT value FROM settings WHERE key = 'storage_limit_bytes'").get();
    const limitBytes = limitSetting ? parseInt(limitSetting.value, 10) : 10 * 1024 * 1024 * 1024;

    const recentFiles = db.prepare(`
      SELECT f.*, fol.name as folder_name 
      FROM files f 
      LEFT JOIN folders fol ON f.folder_id = fol.id 
      WHERE f.user_id = ? 
      ORDER BY f.created_at DESC LIMIT 5
    `).all(userId);

    const hasPin = user.pin_hash ? 1 : 0;

    res.json({
      success: true,
      user: {
        id: user.id,
        first_name: user.first_name,
        username: user.username,
        has_pin: hasPin
      },
      stats: {
        used_bytes: totalUsed,
        limit_bytes: limitBytes,
        used_percentage: Math.min(100, Math.round((totalUsed / limitBytes) * 100)),
        total_files: fileCount,
        total_folders: folderCount
      },
      recent_files: recentFiles
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. Get Folder Tree & Direct Children
 */
app.get('/api/folders', (req, res) => {
  try {
    const userId = req.query.user_id || DEFAULT_USER_ID;
    const parentId = req.query.parent_id && req.query.parent_id !== 'null' ? parseInt(req.query.parent_id, 10) : null;

    const folders = db.prepare(`
      SELECT f.*, 
        (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count,
        (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count
      FROM folders f 
      WHERE f.user_id = ? AND (
        (? IS NULL AND f.parent_id IS NULL) OR (f.parent_id = ?)
      )
      ORDER BY f.name ASC
    `).all(userId, parentId, parentId);

    const files = db.prepare(`
      SELECT * FROM files 
      WHERE user_id = ? AND (
        (? IS NULL AND folder_id IS NULL) OR (folder_id = ?)
      )
      ORDER BY created_at DESC
    `).all(userId, parentId, parentId);

    const breadcrumbs = getBreadcrumbs(parentId, userId);

    res.json({
      success: true,
      current_folder_id: parentId,
      breadcrumbs,
      folders,
      files
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. Create New Folder
 */
app.post('/api/folders', (req, res) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const { name, parent_id, icon, is_private } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    const pId = parent_id && parent_id !== 'null' ? parseInt(parent_id, 10) : null;
    const iconName = icon || 'folder';
    const privFlag = is_private ? 1 : 0;

    const stmt = db.prepare(`
      INSERT INTO folders (user_id, parent_id, name, icon, is_private)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(userId, pId, name.trim(), iconName, privFlag);

    const newFolder = db.prepare('SELECT * FROM folders WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, folder: newFolder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Delete Folder
 */
app.delete('/api/folders/:id', (req, res) => {
  try {
    const userId = req.query.user_id || DEFAULT_USER_ID;
    const folderId = parseInt(req.params.id, 10);

    db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?').run(folderId, userId);
    res.json({ success: true, message: 'Folder deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. Files List & Search API
 */
app.get('/api/files', (req, res) => {
  try {
    const userId = req.query.user_id || DEFAULT_USER_ID;
    const query = req.query.query ? req.query.query.trim().toLowerCase() : null;
    const category = req.query.category || 'all';
    const starredOnly = req.query.starred === '1';
    const dateFilter = req.query.date_filter || 'all';
    const sortBy = req.query.sort_by || 'newest';

    let sql = `
      SELECT f.*, fol.name as folder_name 
      FROM files f 
      LEFT JOIN folders fol ON f.folder_id = fol.id 
      WHERE f.user_id = ?
    `;
    const params = [userId];

    // Search query filter (searches entire vault)
    if (query) {
      sql += ` AND LOWER(f.name) LIKE ?`;
      params.push(`%${query}%`);
    }

    // Category filter
    if (category !== 'all') {
      sql += ` AND f.category = ?`;
      params.push(category);
    }

    // Starred filter
    if (starredOnly) {
      sql += ` AND f.is_starred = 1`;
    }

    // Date filter
    const now = new Date();
    if (dateFilter === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      sql += ` AND f.created_at >= ?`;
      params.push(todayStart);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      sql += ` AND f.created_at >= ?`;
      params.push(weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
      sql += ` AND f.created_at >= ?`;
      params.push(monthAgo);
    }

    // Sorting
    if (sortBy === 'newest') sql += ` ORDER BY f.created_at DESC`;
    else if (sortBy === 'oldest') sql += ` ORDER BY f.created_at ASC`;
    else if (sortBy === 'name') sql += ` ORDER BY f.name ASC`;
    else if (sortBy === 'size') sql += ` ORDER BY f.size DESC`;

    const files = db.prepare(sql).all(...params);

    res.json({
      success: true,
      total: files.length,
      files
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. File Upload Endpoint
 */
app.post('/api/files/upload', upload.single('file'), (req, res) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const folderId = req.body.folder_id && req.body.folder_id !== 'null' ? parseInt(req.body.folder_id, 10) : null;
    const isPrivate = req.body.is_private === '1' ? 1 : 0;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file was uploaded' });
    }

    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;
    const localPath = req.file.path;

    // Detect category
    let category = 'document';
    if (mimeType.startsWith('image/')) category = 'photo';
    else if (mimeType.startsWith('video/')) category = 'video';
    else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.csv')) category = 'excel';
    else if (mimeType.includes('zip') || mimeType.includes('compressed') || fileName.endsWith('.zip') || fileName.endsWith('.rar')) category = 'archive';

    // Save metadata in SQLite
    const telegramFileId = `file_vault_${Date.now()}`;
    const stmt = db.prepare(`
      INSERT INTO files (user_id, folder_id, name, size, mime_type, category, telegram_file_id, local_path, is_starred, is_private)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);
    const info = stmt.run(userId, folderId, fileName, fileSize, mimeType, category, telegramFileId, localPath, isPrivate);

    const newFile = db.prepare('SELECT * FROM files WHERE id = ?').get(info.lastInsertRowid);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: newFile
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 7. Dispatch Download File to Telegram Chat
 */
app.post('/api/files/:id/download', async (req, res) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const chatId = req.body.chat_id || userId;
    const fileId = parseInt(req.params.id, 10);

    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const result = await sendVaultFileToChat(chatId, file);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 8. Toggle Star/Favorite
 */
app.post('/api/files/:id/star', (req, res) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const fileId = parseInt(req.params.id, 10);

    const file = db.prepare('SELECT is_starred FROM files WHERE id = ? AND user_id = ?').get(fileId, userId);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const newStarred = file.is_starred ? 0 : 1;
    db.prepare('UPDATE files SET is_starred = ? WHERE id = ?').run(newStarred, fileId);

    res.json({ success: true, is_starred: newStarred });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 9. Delete File
 */
app.delete('/api/files/:id', (req, res) => {
  try {
    const userId = req.query.user_id || DEFAULT_USER_ID;
    const fileId = parseInt(req.params.id, 10);

    db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?').run(fileId, userId);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 10. Security PIN Lock Endpoints
 */
app.post('/api/pin/setup', (req, res) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const { pin } = req.body;

    if (!pin || pin.length !== 4) {
      return res.status(400).json({ success: false, error: 'PIN must be 4 digits' });
    }

    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(pin, userId);
    res.json({ success: true, message: 'PIN lock enabled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pin/verify', (req, res) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const { pin } = req.body;

    const user = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(userId);
    if (!user || !user.pin_hash) {
      return res.json({ success: true, verified: true }); // No PIN required
    }

    if (user.pin_hash === pin) {
      return res.json({ success: true, verified: true });
    } else {
      return res.status(401).json({ success: false, verified: false, error: 'Invalid 4-digit PIN' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 11. Customization Settings Endpoints
 */
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT key, value FROM settings').all();
    const map = {};
    settings.forEach(s => map[s.key] = s.value);
    res.json({ success: true, settings: map });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const { app_name, storage_limit_bytes, accent_color, require_pin } = req.body;
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

    if (app_name) upsert.run('app_name', app_name);
    if (storage_limit_bytes) upsert.run('storage_limit_bytes', String(storage_limit_bytes));
    if (accent_color) upsert.run('accent_color', accent_color);
    if (require_pin !== undefined) upsert.run('require_pin', String(require_pin ? 1 : 0));

    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback route to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Telegram Document Vault Server running on http://localhost:${PORT}`);
});
