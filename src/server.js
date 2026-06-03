/**
 * server.js
 *
 * Main Express server entry point.
 * Starts the HTTP server, registers routes, and initializes services.
 */
// triggering 
require('dotenv').config();
const express = require('express');
const { handleVerification, handleWebhookEvent } = require('./webhookHandler');
const { initialize: initTokenManager } = require('./tokenManager');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

// Save raw body for Meta signature verification
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check (used by UptimeRobot to keep server alive)
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'Instagram Order Agent',
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
  console.log('  🚀 Instagram Order Agent Started');
  console.log(`  📡 Listening on port ${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Initialize token manager (Risk #2 fix)
  try {
    await initTokenManager();
  } catch (err) {
    console.warn('⚠️  Token manager init failed (check Meta credentials):', err.message);
  }

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
