/**
 * geminiService.js
 *
 * Google Gemini AI integration for natural conversational order-taking.
 * Uses the REST API directly for maximum compatibility.
 */

const axios = require('axios');

let apiKey = null;

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ─── INITIALIZATION ──────────────────────────────────────────────────────────

function initGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log('⚠️ No GEMINI_API_KEY found. AI mode disabled — using regex fallback.');
    return false;
  }
  apiKey = key;
  console.log('✅ Gemini AI initialized (REST API, gemini-2.5-flash)');
  return true;
}

function isAIEnabled() {
  return apiKey !== null;
}

// ─── SYSTEM PROMPT BUILDER ───────────────────────────────────────────────────

function buildSystemPrompt(lang, currentSlots, completedOrdersCount) {
  const langInstruction = {
    ku: `DIALECT RULE: You MUST speak EXACTLY like a real person from Duhok, Kurdistan (Badini dialect). 
Use ONLY Arabic script. NEVER use Sorani words. 
FORBIDDEN WORDS (Never use these Sorani words): "چۆنی", "دەوێت", "بەخێربێیت", "پێویستە", "ئێستا".`,
    ar: 'You MUST respond in Iraqi Arabic. Chat warmly and naturally like an Iraqi person would.',
    en: 'You MUST respond in English. Chat warmly and naturally.',
  }[lang] || 'Respond in the same language the customer uses.';

  const slotStatus = (val) => val || '❌ Not yet collected';

  // --- DYNAMIC MISSION GENERATOR ---
  let missingFields = [];
  if (!currentSlots.product) missingFields.push('Product');
  if (!currentSlots.name) missingFields.push('Name');
  if (!currentSlots.phone) missingFields.push('Phone Number');
  if (!currentSlots.address) missingFields.push('Address');

  let mission = '';
  if (missingFields.length === 0) {
    mission = 'All info collected. Show a short summary of the order and ask the user to confirm (Yes/No).';
  } else if (!currentSlots.product) {
    mission = 'Ask the user WHAT PRODUCT (بەرهەم یان سیستەم) they want to order.';
  } else if (!currentSlots.name) {
    mission = 'The user wants a product. Now ask for their NAME (ناڤێ تە).';
  } else if (!currentSlots.phone) {
    mission = 'CRITICAL MISSION: You MUST ask for their PHONE NUMBER (ژمارا تەلەفۆنا تە). Do not ask for anything else until they give a phone number! Focus ONLY on getting the phone number.';
  } else if (!currentSlots.address) {
    mission = 'Ask for their DELIVERY ADDRESS (ناونیشانێ تە).';
  }

  const additionalOrderContext = completedOrdersCount > 0
    ? `\nThe customer already completed ${completedOrdersCount} order(s). You already have their name, phone, and address. Skip asking for them again!`
    : '';

  return `You are a real, friendly shopkeeper in Duhok responding to Instagram DMs.

LANGUAGE RULES: 
${langInstruction}

*** GOLDEN EXAMPLES (COPY THIS EXACT VIBE AND LENGTH) ***
User: سلام
You: سەرچاڤا، تە چ دڤێت؟

User: من سیستەمێ ڤیژن ٢٤ دڤێت
You: باشە سەرچاڤا. دکارم ناڤێ تە بزانم؟

User: ئەحمەد
You: گەلەک سپاس ئەحمەد. ژمارا تەلەفۆنا تە؟

User: 07501234567
You: باشە، ناونیشانێ تە ل کیڤەیە؟

User: دهۆک، مازی مۆل
You: داواکاریا تە: سیستەمێ ڤیژن ٢٤، ناڤ: ئەحمەد، ژمارە: 07501234567، ناونیشان: دهۆک. دروستە؟
***********************************************************

PERSONALITY RULES (CRITICAL):
1. ACT EXACTLY LIKE THE GOLDEN EXAMPLES ABOVE.
2. BE EXTREMELY SHORT. Never write more than 1 or 2 sentences (max 10 words).
3. NEVER say "I have recorded your name/phone." Just say "باشە" or "گەلەک سپاس" and ask the next question immediately.
4. DO NOT be robotic or overly enthusiastic. Max 1 emoji.
5. If the user asks for a price, tell them to check the Instagram page, then immediately ask if they want to place an order.

>>> YOUR STRICT MISSION FOR THIS SPECIFIC MESSAGE <<<
${mission}
You must follow this mission. Do not ask for two things at once.
${additionalOrderContext}

CURRENT ORDER STATUS:
- Name: ${slotStatus(currentSlots.name)}
- Phone: ${slotStatus(currentSlots.phone)}
- Address: ${slotStatus(currentSlots.address)}
- Product: ${slotStatus(currentSlots.product)}
- Notes: ${slotStatus(currentSlots.notes)}

OUTPUT FORMAT:
You MUST respond ONLY with the JSON object. Do not include markdown code blocks.`;
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
      temperature: 0.2, // Lower temperature makes it follow rules strictly
      responseMimeType: 'application/json',
      responseSchema: {
        type: "OBJECT",
        properties: {
          reply: { type: "STRING" },
          extracted: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING", nullable: true },
              phone: { type: "STRING", nullable: true },
              address: { type: "STRING", nullable: true },
              product: { type: "STRING", nullable: true },
              notes: { type: "STRING", nullable: true }
            }
          },
          action: { type: "STRING", enum: ["chat", "order_confirmed", "human", "no_more_orders"] }
        },
        required: ["reply", "extracted", "action"]
      },
      maxOutputTokens: 500,
    },
  };

  let response;
  try {
    response = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
  } catch (apiErr) {
    // Log the FULL error from Google so we can debug
    const errData = apiErr.response?.data;
    const errStatus = apiErr.response?.status;
    console.error(`❌ Gemini API ${errStatus} error:`, JSON.stringify(errData || apiErr.message).substring(0, 500));
    throw apiErr;
  }

  const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  let parsed;
  try {
    // 1. First strip markdown block if it exists
    let cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // 2. Surgical extraction: find everything between first { and last }
    const match = cleanText.match(/\{[\s\S]*\}/);
    if (match) {
      cleanText = match[0];
    }
    
    parsed = JSON.parse(cleanText);
  } catch (e) {
    console.error('⚠️ Gemini returned invalid JSON:', responseText.substring(0, 200));
    // Super safe fallback if JSON completely fails
    const fallbackMatch = responseText.match(/"reply"\s*:\s*"([^"]+)"/i);
    parsed = {
      reply: fallbackMatch ? fallbackMatch[1] : 'ببورە، دوبارە بنێرە.',
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
