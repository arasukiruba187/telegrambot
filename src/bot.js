const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');

const token = process.env.BOT_TOKEN;
let bot = null;
let isBotActive = false;

if (token && !token.includes('example_bot_token')) {
  try {
    bot = new TelegramBot(token, { polling: true });
    isBotActive = true;
    console.log('🤖 Telegram Bot Service started successfully with polling.');
  } catch (err) {
    console.warn('⚠️ Telegram Bot failed to initialize with provided token:', err.message);
  }
} else {
  console.log('ℹ️ Running in Web-App Standalone Mode. (Set BOT_TOKEN in .env to connect live Telegram Bot)');
}

if (isBotActive && bot) {
  // /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'User';
    const miniAppUrl = process.env.MINI_APP_URL || 'http://localhost:3000';

    // Save/update user in SQLite
    const userId = String(msg.from.id);
    db.prepare(`
      INSERT INTO users (id, first_name, username) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username
    `).run(userId, firstName, msg.from.username || '');

    const welcomeText = `✦ *TELEGRAM DOCUMENT VAULT*\n\nWelcome back, *${firstName}*! 👋\n\nYour encrypted Cloud Document Vault is ready. Manage your files, nested folders, photos, and documents seamlessly with instant search and secure storage inside Telegram.`;

    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔐 OPEN VAULT',
              web_app: { url: miniAppUrl }
            }
          ]
        ]
      }
    };

    bot.sendMessage(chatId, welcomeText, options);
  });

  // Handle direct file uploads sent in Telegram chat
  bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return; // Ignore commands

    const chatId = msg.chat.id;
    const userId = String(msg.from.id);

    let fileId = null;
    let fileName = 'Uploaded_File';
    let fileSize = 0;
    let mimeType = 'application/octet-stream';
    let category = 'document';

    if (msg.document) {
      fileId = msg.document.file_id;
      fileName = msg.document.file_name || 'Document.pdf';
      fileSize = msg.document.file_size || 0;
      mimeType = msg.document.mime_type || 'application/pdf';
      category = mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.csv') ? 'excel' : 'document';
    } else if (msg.photo && msg.photo.length > 0) {
      const highestResPhoto = msg.photo[msg.photo.length - 1];
      fileId = highestResPhoto.file_id;
      fileName = `Photo_${Date.now()}.jpg`;
      fileSize = highestResPhoto.file_size || 0;
      mimeType = 'image/jpeg';
      category = 'photo';
    } else if (msg.video) {
      fileId = msg.video.file_id;
      fileName = msg.video.file_name || `Video_${Date.now()}.mp4`;
      fileSize = msg.video.file_size || 0;
      mimeType = msg.video.mime_type || 'video/mp4';
      category = 'video';
    }

    if (fileId) {
      try {
        db.prepare(`
          INSERT INTO files (user_id, folder_id, name, size, mime_type, category, telegram_file_id, is_starred, is_private)
          VALUES (?, NULL, ?, ?, ?, ?, ?, 0, 0)
        `).run(userId, fileName, fileSize, mimeType, category, fileId);

        bot.sendMessage(chatId, `✅ *File saved to Vault!*\n\n📄 *${fileName}*\n📁 Location: Root Vault\n\nOpen your vault to view, categorize, or search your files.`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔐 VIEW IN VAULT', web_app: { url: process.env.MINI_APP_URL || 'http://localhost:3000' } }]
            ]
          }
        });
      } catch (err) {
        console.error('Error saving uploaded Telegram document:', err);
        bot.sendMessage(chatId, '❌ Failed to save document to your vault database.');
      }
    }
  });
}

/**
 * Dispatch document to user Telegram chat when requested from Mini App
 */
async function sendVaultFileToChat(chatId, telegramFileId, fileName) {
  if (!bot || !isBotActive) {
    return { success: false, mode: 'demo', message: 'Demo Mode: In live bot mode, Telegram sends the file directly to your chat.' };
  }

  try {
    if (telegramFileId && !telegramFileId.startsWith('demo_file_id')) {
      await bot.sendDocument(chatId, telegramFileId, {
        caption: `📄 *${fileName}*\n\nDelivered directly from your Telegram Document Vault.`,
        parse_mode: 'Markdown'
      });
      return { success: true, message: 'Document sent to Telegram chat!' };
    } else {
      await bot.sendMessage(chatId, `📄 *[Demo Document Dispatch]*\n\n*${fileName}*\n\nIn live operation with real Telegram uploads, the bot sends the exact original document binary directly to your chat!`, { parse_mode: 'Markdown' });
      return { success: true, message: 'Demo file notification sent to Telegram chat!' };
    }
  } catch (err) {
    console.error('Error sending file via bot:', err);
    return { success: false, message: err.message };
  }
}

module.exports = {
  bot,
  isBotActive,
  sendVaultFileToChat
};
