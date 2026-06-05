/**
 * aiParser.js
 *
 * Native AI Chatbot Agent using Groq API (llama-3.3-70b-versatile).
 * This completely controls the conversation.
 */

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_NAME = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are a highly intelligent, polite customer service agent for an online business on Instagram.
You MUST speak in the exact language and dialect the customer uses. If they use Kurdish Badini, reply in Badini. If Arabic, reply in Arabic.

Your ultimate goal is to collect all necessary order details:
1. Customer Name
2. Phone Number
3. Delivery Address (City/Neighborhood)
4. Product Details (What they want to buy, and the Quantity)
5. Product Specifications: ONLY ask for Size/Color if the product logically requires it (e.g. ask for shirts/shoes, but DO NOT ask for phones/perfumes/electronics).

CONVERSATION RULES:
- Be very brief and natural. Do not sound like a robot.
- If they just say "hi" or "سلاڤ", greet them warmly and ask how you can help.
- Ask for missing information one step at a time. Do not overwhelm them with a big list of questions.
- If they provide everything in one message, you can complete the order immediately.
- VOCABULARY: When asking for address, use "ناونیشان" or "جهێ ئاکنجیبونێ". Never use words for hospital. When asking for name, use "ناڤێ تە چییە؟".

DATA EXTRACTION RULES:
- Phone numbers: Convert Arabic digits (٠١٢٣٤٥٦٧٨٩) to English digits (0123456789).
- Quantity: Default to "1" if not specified.
- Once you are 100% confident you have gathered Name, Phone, Address, and Product Details, set "isOrderComplete" to true.
- When "isOrderComplete" is true, your "replyToCustomer" should be a final confirmation/thank you message.

CRITICAL INSTRUCTION:
You MUST ALWAYS respond with ONLY a pure JSON object. No markdown formatting, no backticks, no explanations. 
Your response must perfectly match this schema:
{
  "replyToCustomer": "Your reply in the user's language goes here...",
  "isOrderComplete": false,
  "extractedData": {
    "customerName": "",
    "phone": "",
    "address": "",
    "product": "",
    "quantity": "",
    "size": "",
    "color": ""
  }
}`;

/**
 * Sends the full conversation history to Groq AI.
 * @param {Array} messages - Array of {role: 'user'|'assistant', content: string}
 * @returns {object|null} - The JSON Router response
 */
async function getAIResponse(messages) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.startsWith('gsk_')) {
    console.warn('⚠️ GROQ_API_KEY is invalid or missing.');
    return null;
  }

  // Build the message array for the API
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
        temperature: 0.2, // Slightly higher for natural conversation, but low enough for JSON stability
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
