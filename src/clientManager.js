const fs = require('fs');
const path = require('path');

let clientsConfig = {};

try {
  const configPath = path.join(__dirname, '..', 'clients.json');
  if (fs.existsSync(configPath)) {
    const data = fs.readFileSync(configPath, 'utf8');
    clientsConfig = JSON.parse(data);
    console.log(`  Loaded config for ${Object.keys(clientsConfig).length} client(s) from clients.json`);
  } else {
    console.log('  No clients.json — using single-client mode (.env)');
  }
} catch (err) {
  console.error('  Error reading clients.json, running in fallback mode:', err.message);
}

function getClientConfig(pageId) {
  if (!pageId) return null;
  return clientsConfig[pageId] || null;
}

function getToken(pageId) {
  const client = getClientConfig(pageId);
  if (client && client.token) {
    return client.token;
  }
  const { getCurrentToken } = require('./tokenManager');
  return getCurrentToken() || process.env.PAGE_ACCESS_TOKEN;
}

function getSheetId(pageId) {
  const client = getClientConfig(pageId);
  if (client && client.sheetId) {
    return client.sheetId;
  }
  return process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;
}

function getTelegramChatId(pageId) {
  const client = getClientConfig(pageId);
  if (client && client.telegramChatId) {
    return client.telegramChatId;
  }
  return process.env.TELEGRAM_CHAT_ID;
}

module.exports = {
  getClientConfig,
  getToken,
  getSheetId,
  getTelegramChatId
};
