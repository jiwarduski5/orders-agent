/**
 * aiParser.js
 *
 * AI-powered order parser using Google Gemini (FREE tier).
 * Sends the customer's raw message to Gemini and gets back
 * perfectly extracted order fields in JSON.
 *
 * This is the PRIMARY brain. If Gemini fails, the system
 * falls back to the old Regex-based parser (orderParser.js).
 */

const axios = require('axios');

// ─── Gemini API Configuration ─────────────────────────────────────────────────
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ─── The AI Prompt (this is the "brain") ──────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert multilingual order extraction assistant for an online store. You understand Arabic, Kurdish (both Badini/Kurmanji and Sorani dialects), and English perfectly.

Your job is to read a customer's Instagram DM message and extract all order details.

RULES:
1. Extract these fields from the message: customerName, phone, address, product, quantity, size, color
2. If a field is not mentioned, set it to an empty string ""
3. For phone numbers: normalize Arabic digits (٠١٢٣٤٥٦٧٨٩) to English digits (0123456789). Remove spaces and dashes.
4. For quantity: if not explicitly mentioned, default to "1"
5. For size: if not mentioned, set to ""
6. Be smart about context:
   - A line with 2-4 words that looks like a person's name IS the name
   - A line with a city name (like دهوک، هەولێر، بغداد، أربيل، زاخو، سليمانية، موصل) is likely the address
   - Common product words: تيشيرت، قميص، بنطلون، فستان، حذاء، كراس، پانتۆڵ، پێڵاو، کەمەر، جل، بلووز، shirt, t-shirt, pants, shoes, dress
7. Understand Kurdish Badini greetings and words: سلاڤ، سڵاو، سلاو، ناڤ، رەنگ، سایز، مەقاس، جهـ، باژێر، موبایل، ژمارە، پارچە، دانە
8. Understand size words in all languages:
   - English: XS, S, M, L, XL, XXL, 2XL, 3XL
   - Arabic: صغير، وسط، كبير
   - Kurdish: بچووک، ناوەند، مەزن، گەورە
9. Understand color words:
   - Arabic: أبيض، أسود، أحمر، أزرق، أخضر، أصفر، بني، رمادي، وردي، برتقالي
   - Kurdish Badini: سپی، ڕەش، سوور، شین، کەسک، زەرد، قاوەیی، بۆز، پەمبەیی، نارنجی
   - English: white, black, red, blue, green, yellow, brown, gray, pink, orange

RESPOND WITH ONLY A VALID JSON OBJECT. No markdown, no backticks, no explanation. Just the JSON:
{"customerName": "", "phone": "", "address": "", "product": "", "quantity": "", "size": "", "color": ""}`;

/**
 * Sends the customer message to Google Gemini AI and gets extracted order data
 * @param {string} messageText - The raw customer message
 * @returns {object|null} - Parsed order fields or null if AI fails
 */
async function parseWithAI(messageText) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('⚠️ GEMINI_API_KEY not set. Skipping AI parsing.');
    return null;
  }

  try {
    console.log('🤖 Sending message to Gemini AI for parsing...');

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        contents: [
          {
            role: 'user',
            parts: [
              { text: SYSTEM_PROMPT + '\n\nCustomer message:\n' + messageText }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,   // Very low = very precise, no creativity
          maxOutputTokens: 500
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000  // 10 second timeout — if AI is slow, we fall back
      }
    );

    // Extract the AI's response text
    const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiText) {
      console.warn('⚠️ Gemini returned empty response.');
      return null;
    }

    console.log(`🤖 Gemini raw response: ${aiText}`);

    // Clean the response (remove markdown backticks if present)
    const cleanedText = aiText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Parse JSON
    const parsed = JSON.parse(cleanedText);

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

    console.log('✅ Gemini AI successfully extracted order data:', JSON.stringify(result));
    return result;

  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.warn('⏱️ Gemini AI timed out. Falling back to Regex parser.');
    } else if (error.response?.status === 429) {
      console.warn('⚠️ Gemini rate limit hit. Falling back to Regex parser.');
    } else if (error instanceof SyntaxError) {
      console.warn('⚠️ Gemini returned invalid JSON. Falling back to Regex parser.');
    } else {
      console.warn(`⚠️ Gemini AI error: ${error.message}. Falling back to Regex parser.`);
    }
    return null;
  }
}

module.exports = { parseWithAI };
