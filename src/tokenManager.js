const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const TOKEN_FILE = path.join(__dirname, '..', 'token_store.json');
const REFRESH_AFTER_DAYS = 50;

function readTokenStore() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('  Could not read token store:', e.message);
  }
  return { token: process.env.INSTAGRAM_ACCESS_TOKEN, savedAt: null };
}

function writeTokenStore(token) {
  const store = { token, savedAt: new Date().toISOString() };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2));
  console.log('  Token saved securely');
  return store;
}

function getCurrentToken() {
  const store = readTokenStore();
  return store.token || process.env.INSTAGRAM_ACCESS_TOKEN;
}

async function getLongLivedToken(shortLivedToken) {
  try {
    const response = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    });
    const longToken = response.data.access_token;
    console.log('  Long-lived token obtained (good for 60 days)');
    writeTokenStore(longToken);
    return longToken;
  } catch (error) {
    console.error('  Failed to get long-lived token:', error.response?.data || error.message);
    throw error;
  }
}

async function refreshToken() {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    console.warn('  META_APP_ID or META_APP_SECRET not set — skipping token refresh');
    return;
  }
  const currentToken = getCurrentToken();
  try {
    const response = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: currentToken,
      },
    });
    const newToken = response.data.access_token;
    writeTokenStore(newToken);
    console.log('  Token refreshed successfully');
    return newToken;
  } catch (error) {
    console.error('  Token refresh failed:', error.response?.data || error.message);
  }
}

function shouldRefresh() {
  const store = readTokenStore();
  if (!store.savedAt) return false;

  const savedAt = new Date(store.savedAt);
  const now = new Date();
  const diffDays = (now - savedAt) / (1000 * 60 * 60 * 24);

  console.log(`  Token age: ${Math.floor(diffDays)} days`);
  return diffDays >= REFRESH_AFTER_DAYS;
}

function startAutoRefresh() {
  cron.schedule('0 0 * * *', async () => {
    console.log('  Daily token check...');
    if (shouldRefresh()) {
      console.log('  Token >50 days old — refreshing...');
      await refreshToken();
    } else {
      console.log('  Token still fresh');
    }
  });

  console.log('  Token auto-refresh scheduled (daily at midnight)');
}

async function initialize() {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) {
    console.warn('  INSTAGRAM_ACCESS_TOKEN not set — token manager skipped');
    return;
  }

  const store = readTokenStore();

  if (!store.savedAt) {
    console.log('  No stored token — saving from .env...');
    writeTokenStore(process.env.INSTAGRAM_ACCESS_TOKEN);
  } else if (shouldRefresh()) {
    console.log('  Token needs refresh...');
    await refreshToken();
  } else {
    console.log('  Token is valid and fresh');
  }

  startAutoRefresh();
}

module.exports = { initialize, getCurrentToken, getLongLivedToken, refreshToken };
