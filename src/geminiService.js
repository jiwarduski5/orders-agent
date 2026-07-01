/**
 * geminiService.js
 *
 * Google Gemini AI integration for natural conversational order-taking.
 * Uses the REST API directly with n8n-style Function Calling (Tools).
 */

const axios = require('axios');

let apiKey = null;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function initGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log('⚠️ No GEMINI_API_KEY found. AI mode disabled.');
    return false;
  }
  apiKey = key;
  console.log('✅ Gemini AI initialized (Function Calling Mode, gemini-2.5-flash)');
  return true;
}

function isAIEnabled() {
  return apiKey !== null;
}

function buildSystemPrompt(lang, currentSlots, completedOrdersCount) {
  const langInstruction = {
    ku: `DIALECT RULE: You MUST speak EXACTLY like a real person from Duhok, Kurdistan (Badini dialect). 
Use ONLY Arabic script. NEVER use Sorani words. 
BADINI DICTIONARY (Use these exact phrases to sound kind and natural):
- "چەوانی؟ باشی؟" (How are you?)
- "سەرچاڤا" or "سەرچاڤان" (Sure / on my eyes)
- "تە چ دڤێت؟" (What do you want?)
- "گەلەک سپاس" (Thank you very much)
- "د خزمەتا تە دامە" (I am at your service)
- "باشە" (Okay)
- "ببورە" (Sorry)
FORBIDDEN WORDS (Never use these Sorani words): "چۆنی", "دەوێت", "بەخێربێیت", "پێویستە", "ئێستا".`,
    ar: 'You MUST respond in Iraqi Arabic. Chat warmly and naturally like an Iraqi person would.',
    en: 'You MUST respond in English. Chat warmly and naturally.',
  }[lang] || 'Respond in the same language the customer uses.';

  const slotStatus = (val) => val || '❌ Not yet collected';

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

YOUR JOB:
Have a natural conversation with the user to collect their Name, Phone, Address, and the Product they want.
If the user provides any of these pieces of information, you MUST call the "update_order" tool to save them before you reply.
If you have collected ALL 4 pieces of information, you MUST call the "confirm_order" tool.

CURRENT ORDER STATUS (DO NOT TELL THE USER THIS, IT IS JUST FOR YOUR KNOWLEDGE):
- Name: ${slotStatus(currentSlots.name)}
- Phone: ${slotStatus(currentSlots.phone)}
- Address: ${slotStatus(currentSlots.address)}
- Product: ${slotStatus(currentSlots.product)}
- Notes: ${slotStatus(currentSlots.notes)}
`;
}

async function processMessage(lang, chatHistory, currentSlots, completedOrdersCount, userMessage) {
  if (!apiKey) {
    throw new Error('Gemini AI not initialized');
  }

  const systemPrompt = buildSystemPrompt(lang, currentSlots, completedOrdersCount);

  let safeHistory = Array.isArray(chatHistory) ? [...chatHistory] : [];
  if (safeHistory.length > 0 && safeHistory[0].role !== 'user') {
    safeHistory = [];
  }

  const contents = [
    ...safeHistory,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const tools = [{
    function_declarations: [
      {
        name: 'update_order',
        description: 'Call this silently when the user tells you their name, phone, address, or desired product.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Customer name' },
            phone: { type: 'STRING', description: 'Customer phone number' },
            address: { type: 'STRING', description: 'Customer address' },
            product: { type: 'STRING', description: 'Product the customer wants to buy' },
            notes: { type: 'STRING', description: 'Any extra notes' }
          }
        }
      },
      {
        name: 'confirm_order',
        description: 'Call this silently when the user has provided ALL required information and confirms the order.',
        parameters: {
          type: 'OBJECT',
          properties: {
            is_confirmed: { type: 'BOOLEAN', description: 'True if order is completely finished' }
          }
        }
      }
    ]
  }];

  const requestBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools,
    generationConfig: {
      temperature: 0.2
    }
  };

  try {
    let response = await axios.post(`${GEMINI_URL}?key=${apiKey}`, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    if (!response.data.candidates || response.data.candidates.length === 0) {
      throw new Error('Empty response from Gemini');
    }

    let content = response.data.candidates[0].content;
    let part = content.parts[0];

    let extractedData = {};
    let actionStr = "chat";
    let finalReply = "";

    if (part.functionCall) {
      console.log('🤖 Tool Triggered:', part.functionCall.name, part.functionCall.args);
      
      if (part.functionCall.name === 'update_order') {
        extractedData = part.functionCall.args || {};
      } else if (part.functionCall.name === 'confirm_order') {
        actionStr = "order_confirmed";
      }

      contents.push(content);
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: part.functionCall.name,
            response: { name: part.functionCall.name, content: { status: 'success' } }
          }
        }]
      });

      let response2 = await axios.post(`${GEMINI_URL}?key=${apiKey}`, {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools,
        generationConfig: { temperature: 0.2 }
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      finalReply = response2.data.candidates?.[0]?.content?.parts?.[0]?.text || "باشە";
    } else if (part.text) {
      finalReply = part.text;
    }

    finalReply = finalReply.replace(/[\*\_]/g, '').trim();

    // History now tracks text interactions cleanly without leaking JSON logic
    const updatedHistory = [
      ...safeHistory,
      { role: 'user', parts: [{ text: userMessage }] },
      { role: 'model', parts: [{ text: finalReply }] },
    ];

    const trimmedHistory = updatedHistory.length > 20
      ? updatedHistory.slice(updatedHistory.length - 20)
      : updatedHistory;

    return {
      reply: finalReply,
      extracted: extractedData,
      action: actionStr,
      updatedHistory: trimmedHistory,
    };

  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error(`Gemini API 429 error: Quota exceeded. Please wait a minute.`);
    }
    console.error('Gemini API Error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { initGemini, isAIEnabled, processMessage };
