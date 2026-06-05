/**
 * aiParser.js
 *
 * Native AI Chatbot Agent using Groq API.
 * Uses a Two-Phase system:
 * Phase 1: Conversation (isRegistrationStarted: false)
 * Phase 2: Order Registration (isRegistrationStarted: true)
 */

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant'; // Used if primary hits rate limit

// ─── HARDCODED BADINI PHRASES ─────────────────────────────────────────────────
const PHRASES = {
  greeting:      'سلاڤ بخێرهاتی ،کەرەمکە، دێ چاوا شێم خزمەتا تە کەم 🌹',
  askToStart:    'بەلێ تە دڤێت ئەم دەست بوەرگرتنا داخازیا تە بکەین',
  confirmPrompt: 'گەلەک باشە ، دەستخۆش، دوبارە ڵێنێرینێ بکە ئایا پێزانین درستن ، زور باشە ئەم یێل پێنگاڤا دوماهیکێ تە دڤێت گهورینەکێ یان تشتەکی زێدە بکەی ؟',
  orderDone:     'سوپاسیا تە دکەین بۆ دەممێ تە یێ ببها و داخازا بازارکرنەکا خوش بو هەوەیێن بەرێز دکەین ✅'
};

const QUESTIONS = {
  askProduct:  'کەرەمکە، بڵێ تە چ بەرهەمێ دڤێت؟ 🛍️',
  askName:     'ناڤێ جەنابێ تە چییە؟',
  askPhone:    'ژمارا موبایلا تە چییە؟',
  askAddress:  'ناڤونیشانێت تە چییە؟',
  askQty:      'تە چەند پارچە دڤێن ژڤی بەرهەمی؟',
  askSize:     'قەبارەکێ (size) تە چییە؟',
  askColor:    'ڕەنگێ بەرهەمێ تە چییە؟',
};

// ─── CUSTOM RULES ─────────────────────────────────────────────────────────────
const customRulesPath = path.join(__dirname, '..', 'prompt_rules.txt');
let customRules = '';
try {
  customRules = fs.readFileSync(customRulesPath, 'utf8');
} catch (err) {
  console.log('Could not load prompt_rules.txt, using defaults.');
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a customer service agent for an Instagram store.
You speak ONLY in Badini Kurdish. Never use Sorani words like "چیە" or "دەوێ".

═══ TWO-PHASE CONVERSATION SYSTEM ═══
You must track "isRegistrationStarted". 

**PHASE 1: CONVERSATION MODE (isRegistrationStarted: false)**
- The customer is just chatting, asking questions about products, prices, etc.
- Answer their questions naturally in Badini.
- Do NOT interrogate them for their Name, Phone, or Address yet.
- When it feels like they want to order, or they explicitly say they want to order, you MUST ask them EXACTLY: "${PHRASES.askToStart}"
- Wait for them to say Yes (بەلێ, بلا, باشە, ئوکەی, lets go, etc.). 
- Once they say Yes, you set "isRegistrationStarted" to true in your JSON.

**PHASE 2: REGISTRATION MODE (isRegistrationStarted: true)**
- Now you MUST collect their info using ONLY these hardcoded phrases:
  - Product: "${QUESTIONS.askProduct}"
  - Name: "${QUESTIONS.askName}"
  - Phone: "${QUESTIONS.askPhone}"
  - Address: "${QUESTIONS.askAddress}"
  - Quantity: "${QUESTIONS.askQty}"
  - Size (if clothing/shoes): "${QUESTIONS.askSize}"
  - Color: "${QUESTIONS.askColor}"
- Ask ONE question at a time.
- NEVER translate product names. Keep them exactly as the customer typed.

═══ FIXED EVENT PHRASES — COPY THEM EXACTLY ═══
When greeting the user         → use EXACTLY: "${PHRASES.greeting}"
End of order summary           → append EXACTLY: "${PHRASES.confirmPrompt}"
When order confirmed           → use EXACTLY: "${PHRASES.orderDone}"

═══ EXTRA RULES FROM STORE OWNER ═══
${customRules}

═══ SUMMARY FORMAT (use exactly) ═══
تکایە پێداچوونێ د زانیاریێن خوە دا بکە:
📦 کاڵا: [exact product as customer wrote it]
🔢 دانە: [quantity]
📐 قەبارە: [size — only if product needs it]
🎨 ڕەنگ: [color — only if product needs it]
👤 ناڤ: [name]
📱 موبایل: [phone]
📍 ناونیشان: [address]
${PHRASES.confirmPrompt}

═══ JSON RESPONSE FORMAT ═══
Respond ONLY with pure JSON — no extra text.
{
  "isGreeting": false,
  "isRegistrationStarted": false,
  "isOrderComplete": false,
  "replyToCustomer": "Your exact Badini message here",
  "extractedData": {
    "customerName": "",
    "phone": "",
    "address": "",
    "product": "",
    "quantity": "",
    "size": "",
    "color": ""
  }
}
Set "isGreeting" to true ONLY if it's purely a greeting (hi, hello).
Set "isOrderComplete" to true ONLY after the customer confirms the summary.`;

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────
async function getAIResponse(messages) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || !apiKey.startsWith('gsk_')) {
    console.warn('⚠️ GROQ_API_KEY is invalid or missing.');
    return null;
  }

  try {
    let aiText = null;

    // Try primary model first
    try {
      const response = await axios.post(
        GROQ_API_URL,
        {
          model: PRIMARY_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 12000
        }
      );
      aiText = response.data?.choices?.[0]?.message?.content;
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.warn('⚠️ Primary model rate limited! Switching to fallback model...');
        // Try fallback model
        const fallbackResponse = await axios.post(
          GROQ_API_URL,
          {
            model: FALLBACK_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              ...messages
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 12000
          }
        );
        aiText = fallbackResponse.data?.choices?.[0]?.message?.content;
      } else {
        throw err; // Re-throw if it's not a rate limit error
      }
    }

    if (!aiText) return null;

    console.log(`🤖 AI Raw JSON:\n${aiText}`);
    const parsed = JSON.parse(aiText.trim());

    // ── CODE-LEVEL OVERRIDES ────────────────────────────────────────────────
    let reply = parsed.replyToCustomer || PHRASES.greeting;

    if (parsed.isGreeting === true) {
      reply = PHRASES.greeting;
    }
    if (parsed.isOrderComplete === true) {
      reply = PHRASES.orderDone;
    }

    const intentPhrases = ['orderek', 'order dvet', 'tiştek', 'tişt dixwazim', 'bixrim', 'ez dixwazim'];
    let product = (parsed.extractedData?.product || '').trim();
    if (intentPhrases.some(p => product.toLowerCase().includes(p))) {
      product = ''; 
    }

    // Keep track of registration state in the conversation history context
    // We don't actually need to store it outside the AI's internal state since
    // the AI reads the history and figures it out, but it's good to output.

    return {
      replyToCustomer: reply,
      isOrderComplete: !!parsed.isOrderComplete,
      extractedData: {
        customerName: (parsed.extractedData?.customerName || '').trim(),
        phone:        (parsed.extractedData?.phone        || '').trim(),
        address:      (parsed.extractedData?.address      || '').trim(),
        product,
        quantity:     (parsed.extractedData?.quantity     || '').trim(),
        size:         (parsed.extractedData?.size         || '').trim(),
        color:        (parsed.extractedData?.color        || '').trim(),
      }
    };

  } catch (error) {
    console.error(`⚠️ Groq AI error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
    return null;
  }
}

module.exports = { getAIResponse, PHRASES };
