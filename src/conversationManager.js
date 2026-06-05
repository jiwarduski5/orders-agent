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

    // Small natural delay so it feels like a human is typing
    await new Promise(resolve => setTimeout(resolve, 1500));

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
    console.warn(`⚠️ AI failed to respond. Using Step-by-Step Regex fallback.`);
    const { PHRASES, QUESTIONS } = require('./aiParser');
    const allUserText = convo.history.filter(m => m.role === 'user').map(m => m.content).join('\n');
    const regexData = parseOrder(allUserText, `user_${senderId}`, 'DM');

    // Simple intent check for fallback
    const intentPhrases = ['orderek', 'order dvet', 'tiştek', 'tişt dixwazim', 'bixrim', 'ez dixwazim'];
    let fallbackProduct = regexData.product;
    if (intentPhrases.some(p => fallbackProduct.toLowerCase().includes(p))) {
      fallbackProduct = 'يرجى المراجعة';
    }

    let fb = '';
    // If we haven't officially "started" the order
    if (!convo.fallbackStarted) {
      const lowerLast = cleanText.toLowerCase();
      if (lowerLast === 'bale' || lowerLast === 'بەلێ' || lowerLast === 'باشە') {
        convo.fallbackStarted = true;
        fb = QUESTIONS.askProduct;
      } else {
        // Assume anything else before start is just chat, ask them if they want to order
        fb = PHRASES.askToStart;
      }
    } else {
      // Step-by-Step Questioning
      if (fallbackProduct === 'يرجى المراجعة') {
        fb = QUESTIONS.askProduct;
      } else if (!regexData.customerName) {
        fb = QUESTIONS.askName;
      } else if (!regexData.phone) {
        fb = QUESTIONS.askPhone;
      } else if (!regexData.address) {
        fb = QUESTIONS.askAddress;
      } else if (!regexData.quantity || regexData.quantity === '1') { // Fallback parser defaults to 1, ask anyway to be safe
        fb = QUESTIONS.askQty;
        // force quantity check on next turn by removing it temporarily
        if (cleanText.match(/\d+/)) regexData.quantity = cleanText.match(/\d+/)[0]; 
      } else if (!regexData.color || regexData.color === '—' || regexData.color === '') {
        fb = QUESTIONS.askColor;
        // Update color manually if they just typed it
        if (!['بەلێ', 'نەخێر', 'bale'].includes(cleanText)) regexData.color = cleanText;
      } else {
        // Show summary if everything is collected
        const lowerLast = cleanText.toLowerCase();
        if (lowerLast === 'bale' || lowerLast === 'بەلێ' || lowerLast === 'yes') {
          await sendInstagramReply(senderId, PHRASES.orderDone);
          await finalizeOrder(senderId, regexData, false);
          return; // Done
        } else {
          fb = `تکایە پێداچوونێ د زانیاریێن خوە دا بکە:\n📦 کاڵا: ${fallbackProduct}\n🔢 دانە: ${regexData.quantity}\n🎨 ڕەنگ: ${regexData.color}\n👤 ناڤ: ${regexData.customerName}\n📱 موبایل: ${regexData.phone}\n📍 ناونیشان: ${regexData.address}\n${PHRASES.confirmPrompt}`;
        }
      }
    }

    await sendInstagramReply(senderId, fb);
    convo.history.push({ role: 'assistant', content: fb });
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
