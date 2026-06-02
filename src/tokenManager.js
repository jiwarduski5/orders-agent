/**
 * tokenManager.js
 *
 * Handles Risk #2: Instagram Access Token auto-refresh.
 *
 * Flow:
 * 1. On startup, exchanges short-lived token for long-lived (60 days)
 * 2. Saves token + creation date to a local JSON file
 * 3. Every day at midnight, checks if token is older than 50 days
 * 4. If yes → auto-refreshes and saves the new token
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const TOKEN_FILE = path.join(__dirname, '..', 'token_store.json');
const REFRESH_AFTER_DAYS = 50; // Refresh before the 60-day expiry

// ─── Token Store (read/write to file) ────────────────────────────────────────

function readTokenStore() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('⚠️ Could not read token store:', e.message);
  }
  return { token: process.env.INSTAGRAM_ACCESS_TOKEN, savedAt: null };
}

function writeTokenStore(token) {
  const store = { token, savedAt: new Date().toISOString() };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2));
  console.log('✅ Token saved to token_store.json');
  return store;
}

// ─── Get current valid token ──────────────────────────────────────────────────

function getCurrentToken() {
  const store = readTokenStore();
  return store.token || process.env.INSTAGRAM_ACCESS_TOKEN;
}

// ─── Exchange short-lived token for long-lived ────────────────────────────────

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
    console.log('✅ Long-lived token obtained (valid 60 days).');
    writeTokenStore(longToken);
    return longToken;
  } catch (error) {
    console.error('❌ Failed to get long-lived token:', error.response?.data || error.message);
    throw error;
  }
}

// ─── Refresh existing long-lived token ───────────────────────────────────────

async function refreshToken() {
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
    console.log('🔄 Token refreshed successfully.');
    return newToken;
  } catch (error) {
    console.error('❌ Token refresh failed:', error.response?.data || error.message);
  }
}

// ─── Check if token needs refreshing ─────────────────────────────────────────

function shouldRefresh() {
  const store = readTokenStore();
  if (!store.savedAt) return false;

  const savedAt = new Date(store.savedAt);
  const now = new Date();
  const diffDays = (now - savedAt) / (1000 * 60 * 60 * 24);

  console.log(`ℹ️  Token age: ${Math.floor(diffDays)} days.`);
  return diffDays >= REFRESH_AFTER_DAYS;
}

// ─── Start auto-refresh scheduler ─────────────────────────────────────────────

function startAutoRefresh() {
  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Daily token check running...');
    if (shouldRefresh()) {
      console.log('🔄 Token is older than 50 days — refreshing...');
      await refreshToken();
    } else {
      console.log('✅ Token is fresh. No refresh needed.');
    }
  });

  console.log('✅ Token auto-refresh scheduler started (checks daily at midnight).');
}

// ─── Initialize on startup ────────────────────────────────────────────────────

async function initialize() {
  const store = readTokenStore();

  // If no token stored yet, save the one from .env
  if (!store.savedAt) {
    console.log('ℹ️  No stored token found. Saving token from .env...');
    writeTokenStore(process.env.INSTAGRAM_ACCESS_TOKEN);
  } else if (shouldRefresh()) {
    console.log('🔄 Token needs refresh on startup...');
    await refreshToken();
  } else {
    console.log('✅ Token is valid and fresh.');
  }

  startAutoRefresh();
}

module.exports = { initialize, getCurrentToken, getLongLivedToken, refreshToken };
