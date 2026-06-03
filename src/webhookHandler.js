/**
 * webhookHandler.js
 *
 * Handles incoming Instagram webhook events:
 * - Comments on posts
 * - Direct Messages (DMs)
 *
 * Security: Verifies Meta's signature on every request.
 * Deduplication: Tracks processed comment IDs to avoid duplicates.
 */

const crypto = require('crypto');
const { parseOrder, isOrderMessage } = require('./orderParser');
const { appendOrder } = require('./sheetsService');
const { sendOrderNotification } = require('./telegramService');

// ─── In-memory deduplication (prevents duplicate processing) ─────────────────
// In production with many clients, use a database instead
const processedIds = new Set();

// ─── Security: Verify Meta webhook signature ──────────────────────────────────

/**
 * Verifies that the webhook request actually came from Meta.
 * Meta signs each request with your App Secret.
 */
function verifyMetaSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn('⚠️  No signature on webhook request — rejected.');
    return false;
  }

  const expectedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    console.warn('⚠️  Invalid signature — request rejected.');
  }

  return isValid;
}

// ─── Process a single comment ─────────────────────────────────────────────────

async function processComment(commentId, commentText, username, postId) {
  // Skip if already processed (deduplication)
  if (processedIds.has(commentId)) {
    console.log(`ℹ️  Comment ${commentId} already processed. Skipping.`);
    return;
  }

  // Mark as processed immediately (before async ops to prevent race conditions)
  processedIds.add(commentId);

  // Cleanup old IDs to prevent memory leak (keep last 1000 only)
  if (processedIds.size > 1000) {
    const firstId = processedIds.values().next().value;
    processedIds.delete(firstId);
  }

  console.log(`📩 New comment from @${username}: "${commentText}"`);

  // Check if this is an order
  if (!isOrderMessage(commentText)) {
    console.log(`ℹ️  Comment is not an order. Skipping.`);
    return;
  }

  console.log(`🛒 Order detected! Processing...`);

  // Parse the order
  const order = parseOrder(commentText, username, postId);

  // Save to Google Sheets and send Telegram simultaneously
  try {
    const orderNumber = await appendOrder(order);
    await sendOrderNotification(order, orderNumber);
    console.log(`✅ Order #${orderNumber} fully processed.`);
  } catch (error) {
    console.error(`❌ Error processing order:`, error.message);
  }
}

// ─── Process a Direct Message ─────────────────────────────────────────────────

async function processDM(messageId, messageText, senderId) {
  if (processedIds.has(messageId)) {
    console.log(`ℹ️  DM ${messageId} already processed. Skipping.`);
    return;
  }

  processedIds.add(messageId);
  console.log(`📨 New DM from ${senderId}: "${messageText}"`);

  if (!isOrderMessage(messageText)) {
    console.log(`ℹ️  DM is not an order. Skipping.`);
    return;
  }

  const order = parseOrder(messageText, `user_${senderId}`, 'DM');

  try {
    const orderNumber = await appendOrder(order);
    await sendOrderNotification(order, orderNumber);
    console.log(`✅ DM Order #${orderNumber} processed.`);
  } catch (error) {
    console.error(`❌ Error processing DM order:`, error.message);
  }
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────

/**
 * GET /webhook — Meta verification handshake
 * Meta calls this once when you first set up the webhook.
 */
function handleVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified by Meta!');
    return res.status(200).send(challenge);
  }

  console.warn('❌ Webhook verification failed. Check WEBHOOK_VERIFY_TOKEN.');
  return res.status(403).send('Forbidden');
}

/**
 * POST /webhook — Receives real-time Instagram events
 */
async function handleWebhookEvent(req, res) {
  // Always respond to Meta immediately (within 5 seconds or it retries)
  res.status(200).send('EVENT_RECEIVED');

  // Verify the request came from Meta
  if (!verifyMetaSignature(req)) return;

  const body = req.body;

  // Only handle Instagram events
  if (body.object !== 'instagram') {
    console.log(`ℹ️  Ignoring non-Instagram event: ${body.object}`);
    return;
  }

  // Loop through all entries (can be multiple)
  for (const entry of body.entry || []) {
    const pageId = entry.id;

    // ── Comments ──
    for (const change of entry.changes || []) {
      if (change.field === 'comments') {
        const value = change.value;
        await processComment(
          value.id,
          value.text || '',
          value.from?.username || value.from?.id,
          value.media?.id
        );
      }
    }

    // ── Direct Messages (Standard Format) ──
    for (const messaging of entry.messaging || []) {
      if (messaging.message && !messaging.message.is_echo) {
        await processDM(
          messaging.message.mid,
          messaging.message.text || '',
          messaging.sender?.id
        );
      }
    }

    // ── Direct Messages (Test Button / New API Format) ──
    for (const change of entry.changes || []) {
      if (change.field === 'messages') {
        const msgValue = change.value?.message;
        const senderId = change.value?.sender?.id;
        if (msgValue && msgValue.text) {
          await processDM(
            msgValue.mid || `test_mid_${Date.now()}`,
            msgValue.text,
            senderId
          );
        }
      }
    }
  }
}

module.exports = { handleVerification, handleWebhookEvent };
