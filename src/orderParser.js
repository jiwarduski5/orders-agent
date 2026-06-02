/**
 * orderParser.js
 * 
 * Parses Arabic and Kurdish order text from Instagram comments/DMs.
 * Extracts: product name, quantity, size, color, and customer username.
 */

// ─── Keywords that signal an order (Arabic + Kurdish) ─────────────────────────
const ORDER_KEYWORDS = [
  // Arabic
  'أريد', 'اريد', 'أطلب', 'اطلب', 'أرغب', 'ارغب',
  'محتاج', 'محتاجة', 'أحتاج', 'احتاج',
  'طلب', 'اطلبي', 'ابي', 'أبي', 'أبغى', 'ابغى',
  'ممكن', 'كم سعر', 'بكم', 'بچم',
  'اشتري', 'أشتري', 'شراء',
  // Kurdish (Sorani)
  'دەمەوێ', 'دەمەوه', 'دەیدەم', 'داوام هەیە',
  'دەیوێ', 'دەمەوێت', 'بۆم بنێرە', 'بنێرە',
  'کڕین', 'کڕینی', 'چەندە', 'چەند',
  // Kurdish (Kurmanji)
  'ez dixwazim', 'dixwazim', 'sipariş',
  // English fallback
  'want', 'order', 'buy', 'need', 'i need', 'i want'
];

// ─── Size patterns ─────────────────────────────────────────────────────────────
const SIZE_PATTERNS = [
  /\b(xs|s|m|l|xl|xxl|xxxl|2xl|3xl)\b/i,
  /\b(صغير|صغيرة|وسط|وسطي|كبير|كبيرة|كبيرجداً|كبير جداً)\b/,
  /\b(بچووک|ناوەند|مەزن|زۆر مەزن)\b/,
  /مقاس\s*(\w+)/i,
  /سایز\s*(\w+)/i,
  /size\s*(\w+)/i,
];

// ─── Quantity patterns ─────────────────────────────────────────────────────────
const QUANTITY_PATTERNS = [
  /(\d+)\s*(حبة|حبات|قطعة|قطع|عدد|كيلو|كيلوغرام)/,
  /(\d+)\s*(دانه|دانەی|دانە|پارچه)/,
  /(\d+)\s*(pieces?|items?|units?|kg|kilo)/i,
  /(\d+)x\s/i,
  /\bواحد\b|\bواحدة\b/,   // "one" in Arabic
  /\bیەک\b/,              // "one" in Kurdish
];

// ─── Color patterns ─────────────────────────────────────────────────────────────
const COLOR_PATTERNS = [
  // Arabic colors
  /\b(أحمر|احمر|أزرق|ازرق|أخضر|اخضر|أصفر|اصفر|أبيض|ابيض|أسود|اسود|بنفسجي|وردي|زهري|بني|رمادي|برتقالي|ذهبي|فضي)\b/,
  // Kurdish colors (Sorani)
  /\b(سور|شین|سەوز|زەرد|سپی|ڕەش|مۆر|پەمبە|قاوەیی|خاکستری|نارنجی|زێڕین)\b/,
  // English
  /\b(red|blue|green|yellow|white|black|purple|pink|brown|gray|grey|orange|gold|silver)\b/i,
];

/**
 * Checks if a message text contains an order intent
 * @param {string} text - The comment or DM text
 * @returns {boolean}
 */
function isOrderMessage(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ORDER_KEYWORDS.some(keyword => lower.includes(keyword.toLowerCase()));
}

/**
 * Extracts quantity from text
 * @param {string} text
 * @returns {string}
 */
function extractQuantity(text) {
  for (const pattern of QUANTITY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Handle "واحد/یەک" = 1
      if (match[0].includes('واحد') || match[0].includes('یەک')) return '1';
      return match[1] || '1';
    }
  }
  return '1'; // default to 1 if not specified
}

/**
 * Extracts size from text
 * @param {string} text
 * @returns {string}
 */
function extractSize(text) {
  for (const pattern of SIZE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1] || match[0];
  }
  return 'غير محدد'; // "not specified"
}

/**
 * Extracts color from text
 * @param {string} text
 * @returns {string}
 */
function extractColor(text) {
  for (const pattern of COLOR_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return '';
}

/**
 * Main parser function
 * @param {string} text - Raw message text
 * @param {string} username - Instagram username of the customer
 * @param {string} postId - The post the comment was on
 * @returns {object} Parsed order object
 */
function parseOrder(text, username, postId = '') {
  const now = new Date();

  const order = {
    isOrder: isOrderMessage(text),
    customer: username || 'غير معروف',
    rawMessage: text,
    quantity: extractQuantity(text),
    size: extractSize(text),
    color: extractColor(text),
    product: 'يرجى المراجعة', // needs manual review
    postId: postId,
    date: now.toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    time: now.toLocaleTimeString('ar-IQ', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: '🟡 جديد',
  };

  return order;
}

module.exports = { parseOrder, isOrderMessage };
