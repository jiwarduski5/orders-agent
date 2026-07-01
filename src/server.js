/**
 * server.js
 *
 * Main Express server entry point.
 * Starts the HTTP server, registers routes, and initializes services.
 */

require('dotenv').config();
const express = require('express');
const { handleVerification, handleWebhookEvent } = require('./webhookHandler');
const { initialize: initTokenManager } = require('./tokenManager');
const { initTelegramBot } = require('./telegramService');
const { initGemini } = require('./geminiService');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

// Save raw body for Meta signature verification safely
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check (used by UptimeRobot to keep server alive)
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'Instagram Order Agent v2.0',
    time: new Date().toISOString(),
  });
});

// Meta webhook verification (GET)
app.get('/webhook', handleVerification);

// Instagram events receiver (POST)
app.post('/webhook', handleWebhookEvent);

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🚀 Instagram Order Agent v4.0 (AI-Powered)');
  console.log(`  📡 Listening on port ${PORT}`);
  console.log('  💬 Auto-reply + Message buffering enabled');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Initialize token manager
  try {
    await initTokenManager();
  } catch (err) {
    console.warn('⚠️  Token manager init failed (check Meta credentials):', err.message);
  }

  // Initialize Gemini AI
  initGemini();

  // Initialize Telegram Bot
  initTelegramBot();

  console.log('✅ Server ready. Waiting for Instagram events...');
  console.log('');
});

// ─── Global error handler ─────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
});
