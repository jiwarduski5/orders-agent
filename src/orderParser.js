/**
 * orderParser.js
 *
 * Enhanced parser for Arabic/Kurdish/English order text from Instagram DMs.
 * Extracts: phone number, address, customer name, product, quantity, size, color.
 * Supports Arabic digits (٠١٢٣٤٥٦٧٨٩) and English digits (0123456789).
 */

// ─── Arabic-to-English digit converter ────────────────────────────────────────
const ARABIC_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

function normalizeDigits(text) {
  return text.replace(/[٠-٩]/g, d => ARABIC_DIGITS[d] || d);
}

// ─── Keywords that signal an order (Arabic + Kurdish + English) ───────────────
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

// ─── Phone number patterns ──────────────────────────────────────────────────
const PHONE_PATTERNS = [
  // International format: +964..., +966..., +971..., etc.
  /\+?\d{1,4}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{0,4}/,
  // Local format: 07xxxxxxxx (Iraq), 05xxxxxxxx (Saudi), etc.
  /\b0[1-9]\d{8,10}\b/,
  // With Arabic label
  /(?:رقم(?:ي)?|هاتف(?:ي)?|موبايل(?:ي)?|تلفون(?:ي)?|جوال(?:ي)?|phone|mobile|tel)\s*:?\s*([+\d\s-]{7,15})/i,
];

// ─── Address patterns ────────────────────────────────────────────────────────
const ADDRESS_KEYWORDS = [
  'العنوان', 'عنواني', 'عنوان', 'المنطقة', 'منطقة', 'الحي', 'حي',
  'شارع', 'زنقة', 'محلة', 'قرب', 'بجانب', 'خلف', 'أمام', 'مقابل',
  'ناحية', 'قضاء', 'محافظة', 'مدينة', 'بغداد', 'بصرة', 'أربيل',
  'سليمانية', 'نينوى', 'موصل', 'كركوك', 'نجف', 'كربلاء',
  'الرياض', 'جدة', 'مكة', 'دبي', 'أبوظبي', 'عمان', 'القاهرة',
  'address', 'street', 'area', 'district', 'city',
  // Kurdish
  'ناونیشان', 'شەقام', 'گەڕەک',
];

// ─── Name patterns ────────────────────────────────────────────────────────────
const NAME_PATTERNS = [
  /(?:اسمي|الاسم|اسم)\s*:?\s*(.{2,30})/,
  /(?:name|my name)\s*:?\s*(.{2,30})/i,
  /(?:ناوم|ناو)\s*:?\s*(.{2,30})/,
];

// ─── Size patterns ──────────────────────────────────────────────────────────
const SIZE_PATTERNS = [
  /\b(xs|s|m|l|xl|xxl|xxxl|2xl|3xl)\b/i,
  /\b(صغير|صغيرة|وسط|وسطي|كبير|كبيرة|كبيرجداً|كبير جداً)\b/,
  /\b(بچووک|ناوەند|مەزن|زۆر مەزن)\b/,
  /مقاس\s*(\w+)/i,
  /سایز\s*(\w+)/i,
  /size\s*(\w+)/i,
];

// ─── Quantity patterns ──────────────────────────────────────────────────────
const QUANTITY_PATTERNS = [
  /(\d+)\s*(حبة|حبات|قطعة|قطع|عدد|كيلو|كيلوغرام)/,
  /(\d+)\s*(دانه|دانەی|دانە|پارچه)/,
  /(\d+)\s*(pieces?|items?|units?|kg|kilo)/i,
  /(\d+)x\s/i,
  /\bواحد\b|\bواحدة\b/,
  /\bیەک\b/,
];

// ─── Color patterns ─────────────────────────────────────────────────────────
const COLOR_PATTERNS = [
  /\b(أحمر|احمر|أزرق|ازرق|أخضر|اخضر|أصفر|اصفر|أبيض|ابيض|أسود|اسود|بنفسجي|وردي|زهري|بني|رمادي|برتقالي|ذهبي|فضي)\b/,
  /\b(سور|شین|سەوز|زەرد|سپی|ڕەش|مۆر|پەمبە|قاوەیی|خاکستری|نارنجی|زێڕین)\b/,
  /\b(red|blue|green|yellow|white|black|purple|pink|brown|gray|grey|orange|gold|silver)\b/i,
];

// ─── Extraction Functions ─────────────────────────────────────────────────────

/**
 * Checks if text contains an order intent
 */
function isOrderMessage(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ORDER_KEYWORDS.some(keyword => lower.includes(keyword.toLowerCase()));
}

/**
 * Extracts phone number from text (supports Arabic and English digits)
 */
function extractPhone(text) {
  // First normalize Arabic digits to English
  const normalized = normalizeDigits(text);

  // Try labeled patterns first (e.g., "رقمي: 07501234567")
  for (const pattern of PHONE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      // Clean up the phone number
      const phone = (match[1] || match[0]).replace(/[\s-]/g, '').trim();
      if (phone.length >= 7 && phone.length <= 15) {
        return phone;
      }
    }
  }

  // Fallback: find any sequence of 7+ digits that looks like a phone
  const digitSequence = normalized.match(/\+?\d[\d\s-]{6,14}\d/);
  if (digitSequence) {
    const phone = digitSequence[0].replace(/[\s-]/g, '');
    if (phone.length >= 7 && phone.length <= 15) {
      return phone;
    }
  }

  return '';
}

/**
 * Extracts address from text
 */
function extractAddress(text) {
  // Try to find text after address keywords
  const addressRegex = new RegExp(
    `(?:${ADDRESS_KEYWORDS.slice(0, 10).join('|')})\\s*:?\\s*(.{3,80})`,
    'i'
  );
  const match = text.match(addressRegex);
  if (match) {
    // Clean up: stop at newline or another field label
    let address = match[1].split('\n')[0].trim();
    // Remove trailing phone numbers or other fields
    address = address.replace(/(?:رقم|هاتف|موبايل|اسم|phone|name).*/i, '').trim();
    if (address.length > 2) return address;
  }

  // Fallback: check if any known city/area names appear
  const cityMatch = text.match(
    /\b(بغداد|بصرة|أربيل|سليمانية|نينوى|موصل|كركوك|نجف|كربلاء|الرياض|جدة|مكة|دبي|أبوظبي|عمان|القاهرة)\b/
  );
  if (cityMatch) {
    // Try to get surrounding context
    const idx = text.indexOf(cityMatch[0]);
    const start = Math.max(0, text.lastIndexOf('\n', idx) + 1);
    const end = text.indexOf('\n', idx);
    return text.substring(start, end === -1 ? undefined : end).trim();
  }

  return '';
}

/**
 * Extracts customer name from text
 */
function extractName(text) {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Clean up: stop at newline or common delimiters
      let name = match[1].split('\n')[0].trim();
      name = name.replace(/(?:رقم|هاتف|موبايل|عنوان|phone|address).*/i, '').trim();
      if (name.length >= 2 && name.length <= 40) return name;
    }
  }
  return '';
}

/**
 * Extracts quantity from text
 */
function extractQuantity(text) {
  const normalized = normalizeDigits(text);
  for (const pattern of QUANTITY_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      if (match[0].includes('واحد') || match[0].includes('یەک')) return '1';
      return match[1] || '1';
    }
  }
  return '1';
}

/**
 * Extracts size from text
 */
function extractSize(text) {
  for (const pattern of SIZE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1] || match[0];
  }
  return 'غير محدد';
}

/**
 * Extracts color from text
 */
function extractColor(text) {
  for (const pattern of COLOR_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return '';
}

/**
 * Main parser function — extracts all fields from combined message text
 * @param {string} text - Raw message text (may be multiple messages joined by \n)
 * @param {string} username - Instagram username of the customer
 * @param {string} source - 'DM' or post ID
 * @returns {object} Parsed order object
 */
function parseOrder(text, username, source = '') {
  const now = new Date();

  const order = {
    isOrder: isOrderMessage(text),
    customer: username || 'غير معروف',
    customerName: extractName(text),
    phone: extractPhone(text),
    address: extractAddress(text),
    rawMessage: text,
    quantity: extractQuantity(text),
    size: extractSize(text),
    color: extractColor(text),
    product: 'يرجى المراجعة',
    source: source,
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
