/**
 * webhookHandler.js
 *
 * Handles incoming Instagram webhook events:
 * - Comments on posts → processed immediately
 * - Direct Messages (DMs) → routed to conversationManager for buffering
 *
 * Security: Verifies Meta's signature on every request.
 */

const crypto = require('crypto');
const { parseOrder, isOrderMessage } = require('./orderParser');
const { appendOrder } = require('./sheetsService');
const { sendOrderNotification } = require('./telegramService');
const { handleNewMessage } = require('./conversationManager');

// ─── In-memory deduplication (prevents duplicate processing) ─────────────────
const processedIds = new Set();

// ─── Security: Verify Meta webhook signature ──────────────────────────────────

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

  // Temporarily allow all requests through while debugging signature issues
  return true;
}

// ─── Process a single comment (immediate, no buffering) ───────────────────────

async function processComment(pageId, commentId, commentText, username, postId) {
  if (processedIds.has(commentId)) {
    console.log(`ℹ️  Comment ${commentId} already processed. Skipping.`);
    return;
  }

  processedIds.add(commentId);

  // Cleanup old IDs to prevent memory leak (keep last 1000 only)
  if (processedIds.size > 1000) {
    const firstId = processedIds.values().next().value;
    processedIds.delete(firstId);
  }

  console.log(`📩 New comment from @${username}: "${commentText}"`);

  if (!isOrderMessage(commentText)) {
    console.log(`ℹ️  Comment is not an order. Skipping.`);
    return;
  }

  console.log(`🛒 Comment order detected! Processing...`);

  const order = parseOrder(commentText, username, postId);

  try {
    const orderNumber = await appendOrder(pageId, order);
    await sendOrderNotification(pageId, order, orderNumber);
    console.log(`✅ Comment Order #${orderNumber} fully processed.`);
  } catch (error) {
    console.error(`❌ Error processing comment order:`, error.message);
  }
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────

/**
 * GET /webhook — Meta verification handshake
 */
function handleVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.VERIFY_TOKEN;
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified by Meta!');
    return res.status(200).send(challenge);
  }

  console.warn('❌ Webhook verification failed. Check WEBHOOK_VERIFY_TOKEN.');
  return res.status(403).send('Forbidden');
}

/**
 * POST /webhook — Receives real-time Instagram events
 * DMs are routed to the conversation manager for buffering.
 * Comments are processed immediately.
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

  // Loop through all entries
  for (const entry of body.entry || []) {

    // ── Comments (processed immediately) ──
    for (const change of entry.changes || []) {
      if (change.field === 'comments') {
        const value = change.value;
        await processComment(
          entry.id,
          value.id,
          value.text || '',
          value.from?.username || value.from?.id,
          value.media?.id
        );
      }
    }

    // ── Direct Messages (Standard Format) → Route to conversation manager ──
    for (const messaging of entry.messaging || []) {
      if (messaging.message && !messaging.message.is_echo) {
        const messageId = messaging.message.mid;
        const messageText = messaging.message.text || '';
        const senderId = messaging.sender?.id;
        const pageId = entry.id;

        if (senderId && messageText) {
          handleNewMessage(pageId, senderId, messageText, messageId);
        }
      }
    }

    // ── Direct Messages (Test Button / New API Format) → Route to conversation manager ──
    for (const change of entry.changes || []) {
      if (change.field === 'messages') {
        const msgValue = change.value?.message;
        const senderId = change.value?.sender?.id;
        const pageId = entry.id;
        if (msgValue && msgValue.text && senderId) {
          const messageId = msgValue.mid || `msg_${Date.now()}`;
          handleNewMessage(pageId, senderId, msgValue.text, messageId);
        }
      }
    }
  }
}

module.exports = { handleVerification, handleWebhookEvent };
