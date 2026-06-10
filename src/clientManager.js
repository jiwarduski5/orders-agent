const fs = require('fs');
const path = require('path');

/**
 * clientManager.js
 *
 * Manages configuration for multiple Instagram clients.
 * Reads from clients.json if available, otherwise falls back to process.env
 * to ensure backward compatibility and zero downtime.
 */

let clientsConfig = {};

// Load clients.json if it exists
try {
  const configPath = path.join(__dirname, '..', 'clients.json');
  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf8');
    clientsConfig = JSON.parse(data);
    console.log(`✅ Loaded configuration for ${Object.keys(clientsConfig).length} client(s) from clients.json`);
  } else {
    console.log('ℹ️ No clients.json found. Running in single-client fallback mode (using .env).');
  }
} catch (err) {
  console.error('⚠️ Error reading clients.json, running in fallback mode:', err.message);
}

/**
 * Get client config by Instagram Page ID
 */
function getClientConfig(pageId) {
  if (!pageId) return null;
  return clientsConfig[pageId] || null;
}

/**
 * Get Instagram Access Token for a specific page
 */
function getToken(pageId) {
  const client = getClientConfig(pageId);
  if (client && client.token) {
    return client.token;
  }
  // Fallback to primary token
  const { getCurrentToken } = require('./tokenManager');
  return getCurrentToken() || process.env.PAGE_ACCESS_TOKEN;
}

/**
 * Get Google Spreadsheet ID for a specific page
 */
function getSheetId(pageId) {
  const client = getClientConfig(pageId);
  if (client && client.sheetId) {
    return client.sheetId;
  }
  // Fallback to primary sheet
  return process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;
}

/**
 * Get Telegram Chat ID for a specific page
 */
function getTelegramChatId(pageId) {
  const client = getClientConfig(pageId);
  if (client && client.telegramChatId) {
    return client.telegramChatId;
  }
  // Fallback to primary chat ID
  return process.env.TELEGRAM_CHAT_ID;
}

module.exports = {
  getClientConfig,
  getToken,
  getSheetId,
  getTelegramChatId
};
