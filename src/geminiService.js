/**
 * geminiService.js
 *
 * Google Gemini AI integration for natural conversational order-taking.
 * Uses the REST API directly (no SDK) for maximum compatibility with
 * service-account-bound API keys (AQ. format).
 */

const axios = require('axios');

let apiKey = null;

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ─── INITIALIZATION ──────────────────────────────────────────────────────────

function initGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log('⚠️ No GEMINI_API_KEY found. AI mode disabled — using regex fallback.');
    return false;
  }
  apiKey = key;
  console.log('✅ Gemini AI initialized (REST API, gemini-2.0-flash)');
  return true;
}

function isAIEnabled() {
  return apiKey !== null;
}

// ─── SYSTEM PROMPT BUILDER ───────────────────────────────────────────────────

function buildSystemPrompt(lang, currentSlots, completedOrdersCount) {
  const langInstruction = {
    ku: 'You MUST respond in Badini Kurdish (the Kurmanji dialect spoken in Duhok and Erbil, Iraq). Use Arabic/Kurdish script (NOT Latin letters). Chat warmly and naturally like a Kurdish person from Duhok would.',
    ar: 'You MUST respond in Iraqi Arabic. Chat warmly and naturally like an Iraqi person would.',
    en: 'You MUST respond in English. Chat warmly and naturally.',
  }[lang] || 'Respond in the same language the customer uses.';

  const slotStatus = (val) => val || '❌ Not yet collected';

  const additionalOrderContext = completedOrdersCount > 0
    ? `\nThe customer already completed ${completedOrdersCount} order(s) in this session. You already have their name, phone, and address — just ask what product they want next.`
    : '';

  return `You are a friendly and warm shop assistant who helps customers place orders through Instagram DMs.

LANGUAGE: ${langInstruction}

YOUR PERSONALITY:
- You are polite, warm, and genuinely helpful — like a real person, not a robot
- Keep responses SHORT and conversational (1-3 sentences maximum)
- Use emojis naturally but sparingly (1-2 per message max)
- Match the customer's energy — if they're casual, be casual back

YOUR JOB:
- Help customers place orders
- You need to collect: Name, Phone Number, Delivery Address, and what Product they want
- Notes are optional
- Ask for ONE piece of information at a time in a natural conversational way
- Do NOT send a form or numbered list. Have a natural back-and-forth chat
- If a customer gives multiple pieces of info at once, that's great — accept them all
- When you have ALL required info (name + phone + address + product), show a brief summary and ask the customer to confirm it is correct
${additionalOrderContext}

CURRENT ORDER STATUS:
- Name: ${slotStatus(currentSlots.name)}
- Phone: ${slotStatus(currentSlots.phone)}
- Address: ${slotStatus(currentSlots.address)}
- Product: ${slotStatus(currentSlots.product)}
- Notes: ${slotStatus(currentSlots.notes)}

GUIDELINES:
- If customers ask about prices, sizes, colors, or availability: kindly tell them to check the Instagram page for the latest info, then ask if they want to place an order
- If customers want to speak with a real person: respect that immediately and warmly
- Never make up product info, prices, or availability you don't know
- After an order is confirmed, warmly ask if they want to order anything else
- If someone just says hi or sends a greeting, greet them back warmly and ask how you can help

RESPONSE FORMAT — You MUST always respond with this exact JSON structure:
{
  "reply": "your natural conversational reply to the customer",
  "extracted": {
    "name": "value or null",
    "phone": "value or null",
    "address": "value or null",
    "product": "value or null",
    "notes": "value or null"
  },
  "action": "chat"
}

ACTION VALUES (pick exactly one):
- "chat" — Default. Continue conversation (greeting, collecting info, answering questions)
- "order_confirmed" — Customer confirmed the order summary. ONLY use after you showed a summary AND the customer agreed/said yes
- "human" — Customer explicitly asked to talk to a real person or the team
- "no_more_orders" — After completing at least one order, customer said they don't want more

RULES FOR "extracted":
- ALWAYS carry forward previously known values. Never drop a value that was already collected
- Only use null for fields that have NEVER been provided in this conversation
- Keep phone numbers exactly as typed by the customer
- Extract names, addresses, and products in the customer's original language`;
}

// ─── MESSAGE PROCESSING (REST API) ──────────────────────────────────────────

async function processMessage(lang, chatHistory, currentSlots, completedOrdersCount, userMessage) {
  if (!apiKey) {
    throw new Error('Gemini AI not initialized');
  }

  const systemPrompt = buildSystemPrompt(lang, currentSlots, completedOrdersCount);

  // Ensure history is clean (must start with 'user' role)
  let safeHistory = Array.isArray(chatHistory) ? [...chatHistory] : [];
  if (safeHistory.length > 0 && safeHistory[0].role !== 'user') {
    safeHistory = [];
    console.log('⚠️ Chat history was corrupted. Reset to empty.');
  }

  // Build the request body for the REST API
  const contents = [
    ...safeHistory,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      maxOutputTokens: 500,
    },
  };

  const response = await axios.post(
    `${GEMINI_URL}?key=${apiKey}`,
    requestBody,
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );

  const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (e) {
    console.error('⚠️ Gemini returned invalid JSON:', responseText.substring(0, 200));
    parsed = {
      reply: responseText.replace(/[{}"]/g, '').trim().substring(0, 300) || 'ببورە، دوبارە بنێرە.',
      extracted: {},
      action: 'chat',
    };
  }

  // Build updated history
  const updatedHistory = [
    ...safeHistory,
    { role: 'user', parts: [{ text: userMessage }] },
    { role: 'model', parts: [{ text: responseText }] },
  ];

  // Trim to last 20 entries (10 exchanges) to control costs
  const trimmedHistory = updatedHistory.length > 20
    ? updatedHistory.slice(updatedHistory.length - 20)
    : updatedHistory;

  return {
    reply: parsed.reply || '',
    extracted: parsed.extracted || {},
    action: parsed.action || 'chat',
    updatedHistory: trimmedHistory,
  };
}

module.exports = { initGemini, isAIEnabled, processMessage };
