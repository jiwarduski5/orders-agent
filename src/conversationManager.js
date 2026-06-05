/**
 * conversationManager.js
 *
 * Manages conversation state and message buffering for Instagram DMs.
 * INTERACTIVE CHATBOT VERSION:
 * Actively asks the user for missing information (Name, Phone, Address, Product)
 * before sending the order to Telegram.
 */

const { parseWithAI } = require('./aiParser');
const { parseOrder } = require('./orderParser');
const { appendOrder } = require('./sheetsService');
const { sendOrderNotification, sendRawMessageNotification } = require('./telegramService');
const { sendInstagramReply } = require('./instagramReplyService');

// ─── Configuration ────────────────────────────────────────────────────────────
// Shorter timer because we are interacting with them! (15 seconds)
const BUFFER_TIMEOUT_MS = 15 * 1000; 

// ─── Messages ────────────────────────────────────────────────────────────────
const GREETING_MESSAGE =
  `تـو بخێرهاتـی بەرێز \n` +
  `جهی دلخۆشا مەیە کو تە ئەم هەلبژارتین 🛍️\n\n` +
  `بۆ وەرگرتنی داواکاریەکەت، تکایە پێمان بڵێ چیت دەوێت؟ (زانیاری کاڵاکە) 📦`;

const ASK_PRODUCT = `تکایە ناڤێ بەرهەمی و هژمارا پارچان بنێرە 📦`;
const ASK_NAME = `زۆر سوپاس! تکایە ناڤێ خۆت بنێرە 👤`;
const ASK_PHONE = `تکایە ژمارا موبایلێ بنێرە 📱`;
const ASK_ADDRESS = `تکایە جهێ ئاکنجیبونێ (ناونیشان) بە تەواوی بنێرە 📍`;

const ORDER_CONFIRMED_MESSAGE =
  `داخازیا تە سەرکەفتیانە هاتە وەرگرتن ✅🎉\n\n` +
  `سوپاس بو باوەریا تە!💖\n` +
  `لنێزیک دێ پەیوەندیێ بتە کەین 📞`;

// ─── In-memory conversation store ─────────────────────────────────────────────
const conversations = new Map();

const GREETING_WORDS = [
  'hi', 'hello', 'hey', 'مرحبا', 'مرحبًا', 'اهلا', 'أهلا', 'هلا', 'السلام',
  'سڵاو', 'سلاو', 'چۆنی', 'باشی', 'slaw', 'choni', 'سلاڤ', 'slav'
];

function isJustGreeting(text) {
  const cleaned = text.trim().toLowerCase().replace(/[!?.,،؟\s]+/g, ' ').trim();
  return GREETING_WORDS.some(g => cleaned === g || cleaned === g + ' ');
}

/**
 * Handle a new incoming DM message.
 */
function handleNewMessage(senderId, messageText, messageId) {
  let convo = conversations.get(senderId);

  if (!convo) {
    convo = {
      messages: [],
      timer: null,
      greeted: false,
      messageIds: new Set(),
      // Store the accumulated order details across multiple messages
      orderData: {
        customerName: '',
        phone: '',
        address: '',
        product: '',
        quantity: '1',
        size: '',
        color: ''
      }
    };
    conversations.set(senderId, convo);
    console.log(`👋 New interactive conversation started with ${senderId}`);
    
    sendInstagramReply(senderId, GREETING_MESSAGE).catch(e => console.error(e));
    convo.greeted = true;
  }

  // Deduplicate
  if (convo.messageIds.has(messageId)) return;
  convo.messageIds.add(messageId);

  // Buffer message
  if (messageText && messageText.trim()) {
    convo.messages.push(messageText.trim());
    console.log(`📝 User ${senderId} says: "${messageText.trim()}"`);
  }

  // Reset the "typing" timer (15 seconds)
  if (convo.timer) clearTimeout(convo.timer);
  convo.timer = setTimeout(() => {
    processInteractiveConversation(senderId);
  }, BUFFER_TIMEOUT_MS);
}

/**
 * Processes the messages and decides whether to ask a question or finish the order.
 */
async function processInteractiveConversation(senderId) {
  const convo = conversations.get(senderId);
  if (!convo || convo.messages.length === 0) return;

  const combinedText = convo.messages.join('\n');
  convo.messages = []; // Clear the buffer for the next round of messages

  if (isJustGreeting(combinedText) && !convo.orderData.product) {
    // If they just said "hi" and we already greeted them, do nothing
    return;
  }

  console.log(`🧠 Analyzing message block from ${senderId}...`);

  // 1. Parse the new text
  let newExtractedData = null;
  let usedAI = false;

  const aiResult = await parseWithAI(combinedText);
  if (aiResult) {
    usedAI = true;
    newExtractedData = aiResult;
  } else {
    newExtractedData = parseOrder(combinedText, `user_${senderId}`, 'DM');
  }

  // 2. Merge newly found data into the conversation state
  const d = convo.orderData;
  const n = newExtractedData;

  // We only overwrite if the new data is not empty and not the default fallback text
  if (n.customerName && n.customerName !== '—') d.customerName = n.customerName;
  if (n.phone && n.phone !== '—') d.phone = n.phone;
  if (n.address && n.address !== '—') d.address = n.address;
  if (n.product && n.product !== 'يرجى المراجعة') d.product = n.product;
  if (n.size && n.size !== 'غير محدد') d.size = n.size;
  if (n.color && n.color !== '—') d.color = n.color;
  if (n.quantity && n.quantity !== '1') d.quantity = n.quantity;

  // 3. Decide what to do next (Interactive Chatbot Logic)
  // We check what is missing, and ask for it.
  
  if (!d.product) {
    await sendInstagramReply(senderId, ASK_PRODUCT);
    return; // Stop here and wait for their reply
  }
  
  if (!d.customerName) {
    await sendInstagramReply(senderId, ASK_NAME);
    return; 
  }
  
  if (!d.phone) {
    await sendInstagramReply(senderId, ASK_PHONE);
    return;
  }
  
  if (!d.address) {
    await sendInstagramReply(senderId, ASK_ADDRESS);
    return;
  }

  // 4. If we reach this point, ALL required fields are collected!
  console.log(`✅ All details collected from ${senderId}! Finalizing order...`);
  
  const now = new Date();
  const finalOrder = {
    isOrder: true,
    customer: `user_${senderId}`,
    customerName: d.customerName,
    phone: d.phone,
    address: d.address,
    product: d.product,
    quantity: d.quantity,
    size: d.size || 'غير محدد',
    color: d.color || '—',
    rawMessage: 'Interactive Session Completed',
    source: 'DM',
    date: now.toLocaleDateString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    time: now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
    status: '🟡 جديد'
  };

  try {
    const orderNumber = await appendOrder(finalOrder);
    await sendOrderNotification(finalOrder, orderNumber, usedAI);
    await sendInstagramReply(senderId, ORDER_CONFIRMED_MESSAGE);
    conversations.delete(senderId); // End the conversation successfully
  } catch (err) {
    console.error(`❌ Failed to finalize order for ${senderId}:`, err);
  }
}

module.exports = { handleNewMessage };
