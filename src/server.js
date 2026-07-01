require('dotenv').config();
const express = require('express');
const { handleVerification, handleWebhookEvent } = require('./webhookHandler');
const { initialize: initTokenManager } = require('./tokenManager');
const { initTelegramBot } = require('./telegramService');
const { initGemini } = require('./geminiService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'Orders Agent v4.0',
    time: new Date().toISOString(),
  });
});

app.get('/webhook', handleVerification);
app.post('/webhook', handleWebhookEvent);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.listen(PORT, async () => {
  console.log('');
  console.log('  =========================================');
  console.log('  ORDERS AGENT v4.0');
  console.log('  Your friendly shop assistant');
  console.log('  =========================================');
  console.log('');

  const steps = [
    { msg: '.. Starting server on port ' + PORT, delay: 400 },
    { msg: '.. Initializing security layers...', delay: 300 },
    { msg: '.. Connecting to cloud services...', delay: 500 },
  ];

  for (const step of steps) {
    console.log('  ' + step.msg);
    await sleep(step.delay);
  }

  await sleep(300);

  try {
    await initTokenManager();
    console.log('  .. Instagram token manager ready');
  } catch (err) {
    console.warn('  .. Token manager init failed (check Meta credentials):', err.message);
  }

  await sleep(500);

  initGemini();
  await sleep(400);

  initTelegramBot();
  await sleep(400);

  console.log('');
  console.log('  =========================================');
  console.log('  All systems ready!');
  console.log('  Waiting for your customers...');
  console.log('  =========================================');
  console.log('');
});

process.on('unhandledRejection', (reason) => {
  console.error('  !! Oops! Something broke:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('  !! Oops! Something broke:', error.message);
});
