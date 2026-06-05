/**
 * aiParser.js
 *
 * AI-powered order parser using Groq API (FREE Llama 3 70B model).
 * Sends the customer's raw message to Groq and gets back
 * perfectly extracted order fields in JSON.
 *
 * This is the PRIMARY brain. If Groq fails, the system
 * falls back to the Regex-based parser (orderParser.js).
 */

const axios = require('axios');

// ─── Groq API Configuration ───────────────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_NAME = 'llama3-70b-8192'; // The smartest, fastest free model

// ─── The AI Prompt (this is the "brain") ──────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert multilingual order extraction assistant for an online store. You understand Arabic, Kurdish (both Badini/Kurmanji and Sorani dialects), and English.

Your job is to read a customer's Instagram DM message and extract all order details into JSON format.

RULES:
1. Extract these exact fields: "customerName", "phone", "address", "product", "quantity", "size", "color"
2. If a field is not mentioned, set it to an empty string ""
3. For phone numbers: normalize Arabic digits (٠١٢٣٤٥٦٧٨٩) to English digits (0123456789). Remove spaces and dashes.
4. For quantity: if not explicitly mentioned, default to "1"
5. For size: if not mentioned, set to ""
6. Be smart about context:
   - A line with 2-4 words that looks like a person's name IS the name
   - A line with a city name (like دهوک، هەولێر، بغداد، أربيل، زاخو) or area (تاخێ ماسیکێ) is the address
7. Understand Kurdish Badini greetings and words: سلاڤ، سڵاو، ناڤ، رەنگ، سایز، مەقاس، جهـ، باژێر، ژمارە، پارچە، دانە

You must respond with ONLY a valid JSON object. No markdown formatting, no backticks, no explanations. Just raw JSON text.`;

/**
 * Sends the customer message to Groq AI and gets extracted order data
 * @param {string} messageText - The raw customer message
 * @returns {object|null} - Parsed order fields or null if AI fails
 */
async function parseWithAI(messageText) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY; // Fallback for env naming

  if (!apiKey || apiKey.startsWith('AQ.')) {
    console.log('⚠️ GROQ_API_KEY not set or invalid. Skipping AI parsing.');
    return null;
  }

  try {
    console.log('🤖 Sending message to Groq AI (Llama 3) for parsing...');

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: messageText }
        ],
        temperature: 0.1, // Very low = precise, no creativity
        response_format: { type: "json_object" } // Forces pure JSON
      },
      {
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json' 
        },
        timeout: 10000  // 10 second timeout
      }
    );

    // Extract the AI's response text
    const aiText = response.data?.choices?.[0]?.message?.content;

    if (!aiText) {
      console.warn('⚠️ Groq returned empty response.');
      return null;
    }

    console.log(`🤖 Groq raw response: ${aiText}`);

    // Parse JSON
    const parsed = JSON.parse(aiText.trim());

    // Validate the response has the expected structure
    const result = {
      customerName: (parsed.customerName || '').trim(),
      phone: (parsed.phone || '').trim(),
      address: (parsed.address || '').trim(),
      product: (parsed.product || '').trim(),
      quantity: (parsed.quantity || '1').toString().trim(),
      size: (parsed.size || '').trim(),
      color: (parsed.color || '').trim(),
    };

    console.log('✅ Groq AI successfully extracted order data:', JSON.stringify(result));
    return result;

  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.warn('⏱️ Groq AI timed out. Falling back to Regex parser.');
    } else if (error.response?.status === 429) {
      console.warn('⚠️ Groq rate limit hit. Falling back to Regex parser.');
    } else if (error.response?.status === 401) {
      console.warn('⚠️ Groq API key invalid (401). Falling back to Regex parser.');
    } else if (error instanceof SyntaxError) {
      console.warn('⚠️ Groq returned invalid JSON. Falling back to Regex parser.');
    } else {
      console.warn(`⚠️ Groq AI error: ${error.message}. Falling back to Regex parser.`);
    }
    return null;
  }
}

module.exports = { parseWithAI };
