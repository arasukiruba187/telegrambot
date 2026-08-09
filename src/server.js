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

// Multer Storage config for Bulk Uploads
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
 * Utility: Ensure User Exists
 */
function ensureUserExists(userId, firstName = 'Arasu') {
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO users (id, first_name, username) VALUES (?, ?, ?)').run(userId, firstName, 'arasu');
  }
}

/**
 * Utility: Helper to build breadcrumbs path
 */
function getBreadcrumbs(folderId, userId = DEFAULT_USER_ID) {
  const crumbs = [{ id: null, name: 'Vault' }];
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
 * Helper: Find or Create Folder Path (For Folder Uploads)
 */
function getOrCreateFolderPath(userId, folderPathStr, baseParentId = null) {
  if (!folderPathStr || !folderPathStr.trim()) return baseParentId;

  const parts = folderPathStr.split('/').filter(p => p.trim().length > 0);
  let currentParentId = baseParentId;

  for (const part of parts) {
    let folder = db.prepare(`
      SELECT id FROM folders 
      WHERE user_id = ? AND name = ? AND (
        (? IS NULL AND parent_id IS NULL) OR (parent_id = ?)
      )
    `).get(userId, part, currentParentId, currentParentId);

    if (!folder) {
      const info = db.prepare(`
        INSERT INTO folders (user_id, parent_id, name, icon, is_private)
        VALUES (?, ?, ?, 'folder', 0)
      `).run(userId, currentParentId, part);
      currentParentId = info.lastInsertRowid;
    } else {
      currentParentId = folder.id;
    }
  }

  return currentParentId;
}

/**
 * Serve File Stream for Inline Media Previews & Native Sharing
 */
app.get('/api/files/:id/content', (req, res) => {
  try {
    const fileId = parseInt(req.params.id, 10);
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);

    if (!file) {
      return res.status(404).send('File not found');
    }

    if (file.local_path && fs.existsSync(file.local_path)) {
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
      return fs.createReadStream(file.local_path).pipe(res);
    }

    res.status(404).send('File content unavailable');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/**
 * 1. Vault Overview Statistics
 */
app.get('/api/vault', (req, res) => {
  try {
    const userId = req.query.user_id || DEFAULT_USER_ID;
    ensureUserExists(userId, req.query.first_name || 'Arasu');

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
      ORDER BY LOWER(f.name) ASC LIMIT 5
    `).all(userId);

    res.json({
      success: true,
      user: {
        id: user.id,
        first_name: user.first_name,
        username: user.username,
        has_pin: 0
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
 * 2. Get Folder Tree & Direct Children (Always Sorted Ascending A-Z)
 */
app.get('/api/folders', (req, res) => {
  try {
    const userId = req.query.user_id || DEFAULT_USER_ID;
    ensureUserExists(userId);

    const parentId = req.query.parent_id && req.query.parent_id !== 'null' ? parseInt(req.query.parent_id, 10) : null;

    const folders = db.prepare(`
      SELECT f.*, 
        (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count,
        (SELECT COUNT(*) FROM folders WHERE parent_id = f.id) as subfolder_count
      FROM folders f 
      WHERE f.user_id = ? AND (
        (? IS NULL AND f.parent_id IS NULL) OR (f.parent_id = ?)
      )
      ORDER BY LOWER(f.name) ASC
    `).all(userId, parentId, parentId);

    const files = db.prepare(`
      SELECT * FROM files 
      WHERE user_id = ? AND (
        (? IS NULL AND folder_id IS NULL) OR (folder_id = ?)
      )
      ORDER BY LOWER(name) ASC
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
    ensureUserExists(userId);
    const { name, parent_id, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    const pId = parent_id && parent_id !== 'null' ? parseInt(parent_id, 10) : null;
    const iconName = icon || 'folder';

    const stmt = db.prepare(`
      INSERT INTO folders (user_id, parent_id, name, icon, is_private)
      VALUES (?, ?, ?, ?, 0)
    `);
    const info = stmt.run(userId, pId, name.trim(), iconName);

    const newFolder = db.prepare('SELECT * FROM folders WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, folder: newFolder });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Rename Folder
 */
app.put('/api/folders/:id', (req, res) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const folderId = parseInt(req.params.id, 10);
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    db.prepare('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?').run(name.trim(), folderId, userId);
    const updated = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
    res.json({ success: true, folder: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5. Delete Folder
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
 * 6. Files & Folders Unified Search API (Always Sorted Ascending A-Z)
 */
app.get('/api/files', (req, res) => {
  try {
    const userId = req.query.user_id || DEFAULT_USER_ID;
    ensureUserExists(userId);

    const query = req.query.query ? req.query.query.trim().toLowerCase() : null;
    const category = req.query.category || 'all';
    const starredOnly = req.query.starred === '1';
    const dateFilter = req.query.date_filter || 'all';
    const sortBy = req.query.sort_by || 'name';

    // Search Folders matching query
    let matchingFolders = [];
    if (query && category === 'all' && !starredOnly) {
      matchingFolders = db.prepare(`
        SELECT f.*, 'folder' as item_type, 
          (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count
        FROM folders f 
        WHERE f.user_id = ? AND LOWER(f.name) LIKE ?
        ORDER BY LOWER(f.name) ASC
      `).all(userId, `%${query}%`);
    }

    // Search Files matching query
    let sql = `
      SELECT f.*, 'file' as item_type, fol.name as folder_name 
      FROM files f 
      LEFT JOIN folders fol ON f.folder_id = fol.id 
      WHERE f.user_id = ?
    `;
    const params = [userId];

    if (query) {
      sql += ` AND LOWER(f.name) LIKE ?`;
      params.push(`%${query}%`);
    }

    if (category !== 'all') {
      sql += ` AND f.category = ?`;
      params.push(category);
    }

    if (starredOnly) {
      sql += ` AND f.is_starred = 1`;
    }

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

    if (sortBy === 'name' || !req.query.sort_by) {
      sql += ` ORDER BY LOWER(f.name) ASC`;
    } else if (sortBy === 'newest') {
      sql += ` ORDER BY f.created_at DESC`;
    } else if (sortBy === 'oldest') {
      sql += ` ORDER BY f.created_at ASC`;
    } else if (sortBy === 'size') {
      sql += ` ORDER BY f.size DESC`;
    }

    const files = db.prepare(sql).all(...params);

    res.json({
      success: true,
      total: matchingFolders.length + files.length,
      folders: matchingFolders,
      files
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 7. Bulk Files & Folder Upload Endpoint
 */
app.post('/api/files/upload', upload.array('files', 100), (req, res) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    ensureUserExists(userId);
    const baseFolderId = req.body.folder_id && req.body.folder_id !== 'null' ? parseInt(req.body.folder_id, 10) : null;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    let relativePaths = [];
    if (req.body.relative_paths) {
      try {
        relativePaths = typeof req.body.relative_paths === 'string' ? JSON.parse(req.body.relative_paths) : req.body.relative_paths;
      } catch (e) {
        relativePaths = [];
      }
    }

    const uploadedFiles = [];

    const stmt = db.prepare(`
      INSERT INTO files (user_id, folder_id, name, size, mime_type, category, telegram_file_id, local_path, is_starred, is_private)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `);

    req.files.forEach((file, index) => {
      const fileName = file.originalname;
      const fileSize = file.size;
      const mimeType = file.mimetype;
      const localPath = file.path;

      let targetFolderId = baseFolderId;

      const relPath = relativePaths[index];
      if (relPath && relPath.includes('/')) {
        const folderDir = relPath.substring(0, relPath.lastIndexOf('/'));
        targetFolderId = getOrCreateFolderPath(userId, folderDir, baseFolderId);
      }

      let category = 'document';
      if (mimeType.startsWith('image/')) category = 'photo';
      else if (mimeType.startsWith('video/')) category = 'video';
      else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.csv')) category = 'excel';
      else if (mimeType.includes('zip') || mimeType.includes('compressed') || fileName.endsWith('.zip') || fileName.endsWith('.rar')) category = 'archive';

      const telegramFileId = `file_vault_${Date.now()}_${index}`;
      const info = stmt.run(userId, targetFolderId, fileName, fileSize, mimeType, category, telegramFileId, localPath);

      const inserted = db.prepare('SELECT * FROM files WHERE id = ?').get(info.lastInsertRowid);
      uploadedFiles.push(inserted);
    });

    res.json({
      success: true,
      count: uploadedFiles.length,
      files: uploadedFiles
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 8. Bulk Delete Folders & Files
 */
app.post('/api/bulk/delete', (req, res) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const folderIds = req.body.folder_ids || [];
    const fileIds = req.body.file_ids || [];

    if (folderIds.length > 0) {
      const folderStmt = db.prepare(`DELETE FROM folders WHERE user_id = ? AND id = ?`);
      folderIds.forEach(id => folderStmt.run(userId, id));
    }

    if (fileIds.length > 0) {
      const fileStmt = db.prepare(`DELETE FROM files WHERE user_id = ? AND id = ?`);
      fileIds.forEach(id => fileStmt.run(userId, id));
    }

    res.json({ success: true, message: 'Items deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 9. Rename File
 */
app.put('/api/files/:id', (req, res) => {
  try {
    const userId = req.body.user_id || DEFAULT_USER_ID;
    const fileId = parseInt(req.params.id, 10);
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'File name is required' });
    }

    db.prepare('UPDATE files SET name = ? WHERE id = ? AND user_id = ?').run(name.trim(), fileId, userId);
    const updated = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
    res.json({ success: true, file: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 10. Dispatch Download File to Telegram Chat
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
 * 11. Toggle Star/Favorite
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
 * 12. Delete Single File
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
 * 13. Customization Settings Endpoints
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
    const { app_name, storage_limit_bytes, accent_color } = req.body;
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

    if (app_name) upsert.run('app_name', app_name);
    if (storage_limit_bytes) upsert.run('storage_limit_bytes', String(storage_limit_bytes));
    if (accent_color) upsert.run('accent_color', accent_color);

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
