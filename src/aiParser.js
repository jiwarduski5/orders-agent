/**
 * aiParser.js
 *
 * Strict Native AI Chatbot Agent using Groq API.
 * The prompt strictly forbids translating products and forces a summary loop.
 */

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_NAME = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are an expert customer service agent for an online business on Instagram.
You must speak strictly in the dialect the customer uses (e.g. Kurdish Badini, Sorani).

YOUR BEHAVIOR & TONE:
1. Speak clearly and concisely. Do NOT use overly formal or strange translated phrases.
2. If the user just sends a greeting (like "hello", "hi", "سلاڤ", "سڵاو", "مرحبا"), you MUST reply kindly and warmly first (e.g., "سلاڤ، بخێرهاتی! چەوا دکارم هاریکاریا تە بکەم؟ 🌹") before asking for any order details.
3. DO NOT ask "messy" questions or try to guess their order. 
4. IMPORTANT: DO NOT TRANSLATE PRODUCT NAMES OR USER INPUT! If the customer says "Nike t-shirt 2x", extract EXACTLY "Nike t-shirt 2x". Do not translate it to "تیشێرتی نیکە" or anything else. Keep their exact words.

ORDER FLOW:
Step 1: If the user provides an incomplete order, politely ask for what is missing (Name, Phone, Address, Product Details).
Step 2: Once you have collected the Name, Phone, Address, and Product Details, YOU MUST generate a beautiful summary for the user to review. 
Format the summary exactly like this:
تکایە پێداچوونێ د زانیاریێن خوە دا بکە:
📦 کاڵا: [Exact Product words they used]
👤 ناڤ: [Name]
📱 موبایل: [Phone]
📍 ناونیشان: [Address]
ئەرێ ئەڤ زانیارییە دروستن؟ (بەلێ / نەخێر)

Step 3: Wait for the user to say "Yes", "بەلێ", "Ok", or similar. 
If they confirm the summary, set "isOrderComplete" to true and say "داخازیا تە سەرکەفتیانە هاتە وەرگرتن ✅".
If they say "No" and provide corrections, update your data, set "isOrderComplete" to false, and show them the corrected summary again.

CRITICAL INSTRUCTION:
You MUST ALWAYS respond with ONLY a pure JSON object.
{
  "replyToCustomer": "Your message to the user here",
  "isOrderComplete": false,
  "extractedData": {
    "customerName": "",
    "phone": "",
    "address": "",
    "product": "EXACT words used by customer, NO TRANSLATION",
    "quantity": "",
    "size": "EXACT words used by customer",
    "color": "EXACT words used by customer"
  }
}`;

async function getAIResponse(messages) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.startsWith('gsk_')) {
    console.warn('⚠️ GROQ_API_KEY is invalid or missing.');
    return null;
  }

  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages
  ];

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL_NAME,
        messages: apiMessages,
        temperature: 0.1, // Strict, no hallucinations
        response_format: { type: "json_object" }
      },
      {
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json' 
        },
        timeout: 10000 
      }
    );

    const aiText = response.data?.choices?.[0]?.message?.content;
    if (!aiText) return null;

    console.log(`🤖 AI Raw JSON Reply: ${aiText}`);

    const parsed = JSON.parse(aiText.trim());
    return {
      replyToCustomer: parsed.replyToCustomer || 'سلاڤ، فەرموو چەوا دکارم هاریکاریا تە بکەم؟',
      isOrderComplete: !!parsed.isOrderComplete,
      extractedData: {
        customerName: (parsed.extractedData?.customerName || '').trim(),
        phone: (parsed.extractedData?.phone || '').trim(),
        address: (parsed.extractedData?.address || '').trim(),
        product: (parsed.extractedData?.product || '').trim(),
        quantity: (parsed.extractedData?.quantity || '1').toString().trim(),
        size: (parsed.extractedData?.size || '').trim(),
        color: (parsed.extractedData?.color || '').trim(),
      }
    };

  } catch (error) {
    console.error(`⚠️ Groq AI error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
    return null;
  }
}

module.exports = { getAIResponse };
