const crypto = require('crypto');
const { parseOrder, isOrderMessage } = require('./orderParser');
const { appendOrder } = require('./sheetsService');
const { sendOrderNotification } = require('./telegramService');
const { handleNewMessage } = require('./conversationManager');

const processedIds = new Set();

function verifyMetaSignature(req) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return false;
  }

  const expectedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function processComment(pageId, commentId, commentText, username, postId) {
  if (processedIds.has(commentId)) {
    console.log(`  Comment ${commentId} already processed — skipping`);
    return;
  }

  processedIds.add(commentId);

  if (processedIds.size > 1000) {
    const firstId = processedIds.values().next().value;
    processedIds.delete(firstId);
  }

  console.log(`  @${username} commented: "${commentText.slice(0,60)}"`);

  if (!isOrderMessage(commentText)) {
    console.log(`  Not an order — ignoring`);
    return;
  }

  console.log(`  Order detected in comment! Processing...`);

  const order = parseOrder(commentText, username, postId);

  try {
    const orderNumber = await appendOrder(pageId, order);
    await sendOrderNotification(pageId, order, orderNumber);
    console.log(`  Comment order #${orderNumber} done!`);
  } catch (error) {
    console.error(`  Error processing comment:`, error.message);
  }
}

function handleVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.VERIFY_TOKEN;
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('  Webhook verified by Meta!');
    return res.status(200).send(challenge);
  }

  console.warn('  Webhook verification failed — check WEBHOOK_VERIFY_TOKEN');
  return res.status(403).send('Forbidden');
}

async function handleWebhookEvent(req, res) {
  console.log('  Webhook received');
  res.status(200).send('EVENT_RECEIVED');

  if (!verifyMetaSignature(req)) {
    console.log('  Webhook signature invalid — dropped');
    return;
  }

  const body = req.body;

  if (body.object !== 'instagram') {
    console.log(`  Ignoring non-Instagram event: ${body.object}`);
    return;
  }

  for (const entry of body.entry || []) {
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
