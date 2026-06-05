/**
 * conversationManager.js
 *
 * Strict Native AI Chatbot Manager.
 * AI talks to the user, but with strict guardrails to prevent weird translations.
 */

const { getAIResponse } = require('./aiParser');
const { parseOrder } = require('./orderParser');
const { appendOrder } = require('./sheetsService');
const { sendOrderNotification } = require('./telegramService');
const { sendInstagramReply } = require('./instagramReplyService');

const conversations = new Map();

/**
 * Handle a new incoming DM message immediately.
 */
async function handleNewMessage(senderId, messageText, messageId) {
  if (!messageText || !messageText.trim()) return;

  let convo = conversations.get(senderId);

  // Initialize conversation state
  if (!convo) {
    convo = {
      history: [],
      messageIds: new Set()
    };
    conversations.set(senderId, convo);
    console.log(`💬 New AI Chat Session started with ${senderId}`);
  }

  if (convo.messageIds.has(messageId)) return;
  convo.messageIds.add(messageId);

  const cleanText = messageText.trim();
  console.log(`👤 User ${senderId}: "${cleanText}"`);
  convo.history.push({ role: 'user', content: cleanText });

  // ─── STRICT AI ROUTING ──────────────────────────────────────────────────
  const aiResult = await getAIResponse(convo.history);

  if (aiResult) {
    console.log(`🤖 AI Reply: "${aiResult.replyToCustomer}"`);
    await sendInstagramReply(senderId, aiResult.replyToCustomer);
    
    // Check if the AI decided the user CONFIRMED the final summary
    if (aiResult.isOrderComplete) {
      console.log(`✅ Order completely confirmed by user! Finalizing...`);
      await finalizeOrder(senderId, aiResult.extractedData, true);
      return;
    }

    convo.history.push({ role: 'assistant', content: aiResult.replyToCustomer });

  } else {
    // ─── REGEX FALLBACK (If Groq is down) ────────────────────────────────
    console.warn(`⚠️ AI failed to respond. Using Regex fallback.`);
    const allUserText = convo.history.filter(m => m.role === 'user').map(m => m.content).join('\n');
    const regexData = parseOrder(allUserText, `user_${senderId}`, 'DM');

    if (regexData.customerName && regexData.phone && regexData.address && regexData.product !== 'يرجى المراجعة') {
      await sendInstagramReply(senderId, `داخازیا تە سەرکەفتیانە هاتە وەرگرتن ✅`);
      await finalizeOrder(senderId, regexData, false);
    } else {
      const fb = `سلاڤ، تکایە زانیاریێن خوە (ناڤ، ژمارا موبایلێ، ناونیشان و داخازیا خوە) بنێرە دا کو داخازیا تە وەرگرین. 📦`;
      await sendInstagramReply(senderId, fb);
      convo.history.push({ role: 'assistant', content: fb });
    }
  }
}

/**
 * Saves to Sheets, sends Telegram alert, and deletes the conversation.
 */
async function finalizeOrder(senderId, data, usedAI) {
  const now = new Date();
  const convo = conversations.get(senderId);
  let fullChatHistory = 'Processed via Strict AI Chatbot';
  
  if (convo && convo.history && convo.history.length > 0) {
    fullChatHistory = convo.history.map(msg => {
      const emoji = msg.role === 'user' ? '👤 Customer' : '🤖 AI';
      return `${emoji}: ${msg.content}`;
    }).join('\n\n');
  }

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
    conversations.delete(senderId); 
  } catch (err) {
    console.error(`❌ Failed to finalize order for ${senderId}:`, err);
  }
}

module.exports = { handleNewMessage };
