/**
 * conversationManager.js
 *
 * Native AI Chatbot Manager.
 * Instantly replies to messages using Groq AI.
 * Keeps conversation history and controls order flow.
 */

const { getAIResponse } = require('./aiParser');
const { parseOrder } = require('./orderParser');
const { appendOrder } = require('./sheetsService');
const { sendOrderNotification } = require('./telegramService');
const { sendInstagramReply } = require('./instagramReplyService');

// ─── In-memory conversation store ─────────────────────────────────────────────
// Maps senderId -> { history: Array<{role, content}>, messageIds: Set<string> }
const conversations = new Map();

// Fallback logic if AI is completely broken
const FALLBACK_MESSAGE = `سلاڤ، تکایە زانیاریێن خوە (ناڤ، ژمارا موبایلێ، ناونیشان و داخازیا خوە) بنێرە دا کو داخازیا تە وەرگرین. 📦`;

/**
 * Handle a new incoming DM message immediately.
 */
async function handleNewMessage(senderId, messageText, messageId) {
  if (!messageText || !messageText.trim()) return;

  let convo = conversations.get(senderId);

  // Initialize conversation state if it doesn't exist
  if (!convo) {
    convo = {
      history: [],
      messageIds: new Set()
    };
    conversations.set(senderId, convo);
    console.log(`💬 New AI Chat Session started with ${senderId}`);
  }

  // Deduplicate exact same message IDs from Webhook retries
  if (convo.messageIds.has(messageId)) return;
  convo.messageIds.add(messageId);

  const cleanText = messageText.trim();
  console.log(`👤 User ${senderId}: "${cleanText}"`);

  // Add user message to history
  convo.history.push({ role: 'user', content: cleanText });

  // ─── AI ROUTING ──────────────────────────────────────────────────────────
  const aiResult = await getAIResponse(convo.history);

  if (aiResult) {
    // 1. Send the AI's natural reply back to Instagram
    console.log(`🤖 AI Reply: "${aiResult.replyToCustomer}"`);
    await sendInstagramReply(senderId, aiResult.replyToCustomer);

    // 2. Add AI's reply to history so it remembers the context for the next turn
    convo.history.push({ role: 'assistant', content: aiResult.replyToCustomer });

    // 3. Check if AI determined the order is finished!
    if (aiResult.isOrderComplete) {
      console.log(`✅ AI decided order is COMPLETE for ${senderId}! Finalizing...`);
      await finalizeOrder(senderId, aiResult.extractedData, true);
    }

  } else {
    // ─── REGEX FALLBACK (If Groq is down) ────────────────────────────────
    console.warn(`⚠️ AI failed to respond. Using Regex fallback.`);
    
    // Combine all user messages from history
    const allUserText = convo.history.filter(m => m.role === 'user').map(m => m.content).join('\n');
    const regexData = parseOrder(allUserText, `user_${senderId}`, 'DM');

    // If Regex thinks it has everything
    if (regexData.customerName && regexData.phone && regexData.address && regexData.product !== 'يرجى المراجعة') {
      await sendInstagramReply(senderId, `داخازیا تە سەرکەفتیانە هاتە وەرگرتن ✅`);
      await finalizeOrder(senderId, regexData, false);
    } else {
      // Just send the fallback static prompt
      await sendInstagramReply(senderId, FALLBACK_MESSAGE);
      convo.history.push({ role: 'assistant', content: FALLBACK_MESSAGE });
    }
  }
}

/**
 * Saves to Sheets, sends Telegram alert, and deletes the conversation.
 */
async function finalizeOrder(senderId, data, usedAI) {
  const now = new Date();
  
  const convo = conversations.get(senderId);
  let fullChatHistory = 'Processed via Native AI Chatbot';
  
  if (convo && convo.history && convo.history.length > 0) {
    fullChatHistory = convo.history.map(msg => {
      const emoji = msg.role === 'user' ? '👤 Customer' : '🤖 AI';
      return `${emoji}: ${msg.content}`;
    }).join('\n\n');
  }

  // Format exactly how Telegram expects it
  const finalOrder = {
    isOrder: true,
    customer: `user_${senderId}`,
    customerName: data.customerName || '—',
    phone: data.phone || '—',
    address: data.address || '—',
    product: data.product || '—',
    quantity: data.quantity || '1',
    size: data.size || 'غير محدد',
    color: data.color || '—',
    rawMessage: fullChatHistory,
    source: 'DM',
    date: now.toLocaleDateString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    time: now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
    status: '🟡 جديد'
  };

  try {
    const orderNumber = await appendOrder(finalOrder);
    await sendOrderNotification(finalOrder, orderNumber, usedAI);
    
    // Order is done, delete conversation history so they can start a new order later
    conversations.delete(senderId); 
  } catch (err) {
    console.error(`❌ Failed to finalize order for ${senderId}:`, err);
  }
}

module.exports = { handleNewMessage };
