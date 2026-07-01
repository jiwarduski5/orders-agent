const axios = require('axios');
const keyManager = require('./keyManager');

let ready = false;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function initGemini() {
  ready = keyManager.initKeys();
  if (ready) {
    console.log('  Gemini AI ready with', keyManager.getKeyCount(), 'key(s)');
  } else {
    console.log('  No Gemini API keys found — AI mode disabled');
  }
  return ready;
}

function isAIEnabled() {
  return ready;
}

function buildSystemPrompt(lang, currentSlots, completedOrdersCount) {
  const langInstruction = {
    ku: `Speak Badini Kurdish (Duhok dialect) in Arabic script. Be warm, natural, never Sorani.
Use phrases like: "سەرچاڤا", "چەوانی؟", "گەلەک سپاس", "باشە", "د خزمەتا تە دامە"
Never use: "چۆنی", "دەوێت", "بەخێربێیت", "پێویستە", "ئێستا"`,
    ar: 'Speak Iraqi Arabic. Be warm and natural like a friendly shop owner.',
    en: 'Speak English. Be warm, casual, and natural.',
  }[lang] || 'Use the same language as the customer.';

  const slotStatus = (val) => val || 'not yet';

  return `You are a friendly shop assistant in Duhok chatting on Instagram DMs. Talk like a real person — be warm, short, and natural.

LANGUAGE: ${langInstruction}

RULES:
- Be short (1-2 sentences max, like 5-10 words)
- Be kind, natural
- Never be robotic or formal
- If they ask price, say "check our Insta page" then ask if they want to order
- Never list back everything — just say "باشە" or "okay" and ask the next thing
- Sound like a real person texting, not a customer service script

YOUR JOB:
Chat naturally to collect: Name, Phone, Address, Product.
When they give info, call "update_order" silently before replying.
When ALL 4 are collected, call "confirm_order".

CURRENT PROGRESS (just for you):
- Name: ${slotStatus(currentSlots.name)}
- Phone: ${slotStatus(currentSlots.phone)}
- Address: ${slotStatus(currentSlots.address)}
- Product: ${slotStatus(currentSlots.product)}
- Notes: ${slotStatus(currentSlots.notes)}
`;
}

async function callGemini(apiKey, systemPrompt, contents, tools) {
  return axios.post(`${GEMINI_URL}?key=${apiKey}`, {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools,
    generationConfig: { temperature: 0.7 }
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  });
}

async function processMessage(lang, chatHistory, currentSlots, completedOrdersCount, userMessage) {
  if (!ready) {
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

  const allKeys = keyManager.getAllKeys();

  for (let attempt = 0; attempt < allKeys.length; attempt++) {
    const apiKey = allKeys[attempt];

    try {
      let response = await callGemini(apiKey, systemPrompt, contents, tools);

      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error('Empty response from Gemini');
      }

      let content = response.data.candidates[0].content;
      let part = content.parts[0];

      let extractedData = {};
      let actionStr = "chat";
      let finalReply = "";

      if (part.functionCall) {
        console.log('  Tool:', part.functionCall.name, JSON.stringify(part.functionCall.args).slice(0,80));

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

        let response2 = await callGemini(apiKey, systemPrompt, contents, tools);
        finalReply = response2.data.candidates?.[0]?.content?.parts?.[0]?.text || "باشە";
      } else if (part.text) {
        finalReply = part.text;
      }

      finalReply = finalReply.replace(/[\*\_]/g, '').trim();

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
        console.log(`  Key #${attempt + 1} hit quota, trying key #${attempt + 2}...`);
        continue;
      }
      if (error.code === 'ECONNABORTED' || error.response?.status === 500 || error.response?.status === 503) {
        console.log(`  Key #${attempt + 1} server error, trying next...`);
        continue;
      }
      throw error;
    }
  }

  throw new Error('All Gemini keys exhausted');
}

module.exports = { initGemini, isAIEnabled, processMessage };
