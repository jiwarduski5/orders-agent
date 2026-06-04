/**
 * conversationManager.js
 *
 * Manages conversation state and message buffering for Instagram DMs.
 * Groups multiple messages from the same user into a single order.
 *
 * Flow:
 * 1. First message from a new user → Send greeting, start buffer
 * 2. Subsequent messages → Add to buffer, reset 2-minute timer
 * 3. After 2 minutes of silence → Process all buffered messages as ONE order
 */

const { parseOrder } = require('./orderParser');
const { appendOrder } = require('./sheetsService');
const { sendOrderNotification, sendRawMessageNotification } = require('./telegramService');
const { sendInstagramReply } = require('./instagramReplyService');

// ─── Configuration ────────────────────────────────────────────────────────────
const BUFFER_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// ─── Messages (edit these to customize!) ──────────────────────────────────────

const GREETING_MESSAGE =
  `أهلاً وسهلاً بك! 👋✨\n` +
  `\n` +
  `يسعدنا تواصلك معنا! 🛍️\n` +
  `\n` +
  `لإتمام طلبك، أرسل لنا التالي:\n` +
  `📦 اسم المنتج والكمية\n` +
  `📐 المقاس واللون\n` +
  `📱 رقم الهاتف\n` +
  `📍 العنوان\n` +
  `👤 الاسم الكامل\n` +
  `\n` +
  `يمكنك إرسالها في رسالة واحدة أو عدة رسائل 😊`;

const ORDER_CONFIRMED_MESSAGE =
  `تم استلام طلبك بنجاح! ✅🎉\n` +
  `\n` +
  `شكراً لثقتك بنا! 💖\n` +
  `سنتواصل معك قريباً لتأكيد التفاصيل 📞\n` +
  `\n` +
  `نتمنى لك تجربة تسوق ممتعة! 🛍️💫`;

const MESSAGE_RECEIVED_MESSAGE =
  `تم استلام رسالتك! ✅\n` +
  `\n` +
  `سنتواصل معك قريباً 🙏\n` +
  `شكراً لتواصلك معنا! 💫`;

// ─── In-memory conversation store ─────────────────────────────────────────────
// Map<senderId, { messages: string[], timer: NodeJS.Timeout, greeted: boolean, messageIds: Set }>
const conversations = new Map();

// Common greetings that should NOT be forwarded to Telegram if sent alone
const GREETING_WORDS = [
  'hi', 'hello', 'hey', 'مرحبا', 'مرحبًا', 'اهلا', 'أهلا', 'هلا', 'السلام',
  'السلام عليكم', 'سلام', 'هاي', 'الو', 'شلونكم', 'شلونك'
];

/**
 * Checks if the combined text is just greetings (nothing useful to process)
 */
function isJustGreeting(text) {
  const cleaned = text.trim().toLowerCase().replace(/[!?.,،؟\s]+/g, ' ').trim();
  return GREETING_WORDS.some(g => cleaned === g || cleaned === g + ' ');
}

/**
 * Handle a new incoming DM message.
 * Buffers the message and manages the conversation lifecycle.
 *
 * @param {string} senderId - Instagram-scoped user ID
 * @param {string} messageText - The text content of the message
 * @param {string} messageId - Unique message ID for deduplication
 */
function handleNewMessage(senderId, messageText, messageId) {
  let convo = conversations.get(senderId);

  if (!convo) {
    // ── First message from this user → Send greeting ──
    convo = {
      messages: [],
      timer: null,
      greeted: false,
      messageIds: new Set(),
    };
    conversations.set(senderId, convo);

    console.log(`👋 New conversation started with ${senderId}`);

    // Send the greeting message
    sendInstagramReply(senderId, GREETING_MESSAGE).catch(err => {
      console.error(`❌ Failed to send greeting to ${senderId}:`, err.message);
    });
    convo.greeted = true;
  }

  // ── Deduplicate messages ──
  if (convo.messageIds.has(messageId)) {
    console.log(`ℹ️ Duplicate message ${messageId} from ${senderId}. Skipping.`);
    return;
  }
  convo.messageIds.add(messageId);

  // ── Buffer the message ──
  if (messageText && messageText.trim()) {
    convo.messages.push(messageText.trim());
    console.log(`📝 Buffered message from ${senderId}: "${messageText.trim()}"`);
  }

  // ── Reset the 2-minute timer ──
  if (convo.timer) {
    clearTimeout(convo.timer);
  }

  convo.timer = setTimeout(() => {
    processConversation(senderId);
  }, BUFFER_TIMEOUT_MS);
}

/**
 * Called when the 2-minute silence timer expires.
 * Combines all buffered messages and processes them as a single order.
 */
async function processConversation(senderId) {
  const convo = conversations.get(senderId);
  if (!convo || convo.messages.length === 0) {
    conversations.delete(senderId);
    return;
  }

  // Combine all messages into one block
  const combinedText = convo.messages.join('\n');
  const messageCount = convo.messages.length;

  console.log(`⏰ Timer expired. Processing ${messageCount} message(s) from ${senderId}`);
  console.log(`📄 Combined text:\n${combinedText}`);

  // If the user only sent greetings, don't process
  if (isJustGreeting(combinedText)) {
    console.log(`ℹ️ Only greetings from ${senderId}. Waiting for order info.`);
    conversations.delete(senderId);
    return;
  }

  // Parse the combined text with the enhanced parser
  const order = parseOrder(combinedText, `user_${senderId}`, 'DM');

  try {
    // Check if we extracted useful order data
    const hasUsefulData = order.phone || order.address || order.customerName || order.isOrder;

    if (hasUsefulData) {
      // ── Success path: Save + Notify + Confirm ──
      const orderNumber = await appendOrder(order);
      await sendOrderNotification(order, orderNumber);
      await sendInstagramReply(senderId, ORDER_CONFIRMED_MESSAGE);
      console.log(`✅ Order #${orderNumber} from ${senderId} fully processed.`);
    } else {
      // ── Fallback path: Forward raw message to Telegram ──
      await sendRawMessageNotification(senderId, combinedText);
      await sendInstagramReply(senderId, MESSAGE_RECEIVED_MESSAGE);
      console.log(`📤 Raw message from ${senderId} forwarded to Telegram.`);
    }
  } catch (error) {
    console.error(`❌ Error processing conversation from ${senderId}:`, error.message);
    // Last resort: try to forward raw message to Telegram
    try {
      await sendRawMessageNotification(senderId, combinedText);
    } catch (e) {
      console.error(`❌ Even raw Telegram forward failed:`, e.message);
    }
  }

  // Clean up the conversation
  conversations.delete(senderId);
}

module.exports = { handleNewMessage };
