/**
 * geminiService.js
 *
 * Google Gemini AI integration for natural conversational order-taking.
 * Authenticates using the SAME service account as Google Sheets (OAuth2).
 * No separate API key needed!
 */

const { google } = require('googleapis');
const axios = require('axios');

let authClient = null;
let projectId = null;

// ─── INITIALIZATION ──────────────────────────────────────────────────────────

function initGemini() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    console.log('⚠️ No service account credentials found. AI mode disabled.');
    return false;
  }

  try {
    authClient = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    // Extract project ID from service account email: name@PROJECT_ID.iam.gserviceaccount.com
    const emailParts = email.split('@');
    if (emailParts.length === 2) {
      projectId = emailParts[1].replace('.iam.gserviceaccount.com', '');
    }

    console.log(`✅ Gemini AI initialized (Vertex AI, project: ${projectId})`);
    return true;
  } catch (err) {
    console.error('❌ Failed to initialize Gemini:', err.message);
    return false;
  }
}

function isAIEnabled() {
  return authClient !== null;
}

// ─── GET ACCESS TOKEN ────────────────────────────────────────────────────────

async function getAccessToken() {
  const tokens = await authClient.authorize();
  return tokens.access_token;
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

// ─── MESSAGE PROCESSING (OAuth2 REST API) ────────────────────────────────────

async function processMessage(lang, chatHistory, currentSlots, completedOrdersCount, userMessage) {
  if (!authClient) {
    throw new Error('Gemini AI not initialized');
  }

  const systemPrompt = buildSystemPrompt(lang, currentSlots, completedOrdersCount);

  // Ensure history is clean (must start with 'user' role)
  let safeHistory = Array.isArray(chatHistory) ? [...chatHistory] : [];
  if (safeHistory.length > 0 && safeHistory[0].role !== 'user') {
    safeHistory = [];
    console.log('⚠️ Chat history was corrupted. Reset to empty.');
  }

  // Build the request body
  const contents = [
    ...safeHistory,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      maxOutputTokens: 500,
    },
  };

  // Get a fresh OAuth2 access token from the service account
  const accessToken = await getAccessToken();

  // Vertex AI endpoint — works with service account auth
  const geminiUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`;

  let response;
  try {
    response = await axios.post(
      geminiUrl,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 15000,
      }
    );
  } catch (apiErr) {
    const errData = apiErr.response?.data;
    const errStatus = apiErr.response?.status;
    console.error(`❌ Gemini API ${errStatus} error:`, JSON.stringify(errData || apiErr.message).substring(0, 500));
    throw apiErr;
  }

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

  // Trim to last 20 entries (10 exchanges)
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
