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
  'أريد', 'اريد', 'أطلب', 'اطلب', 'أرغب', 'ارغب',
  'محتاج', 'محتاجة', 'أحتاج', 'احتاج',
  'طلب', 'اطلبي', 'ابي', 'أبي', 'أبغى', 'ابغى',
  'ممكن', 'كم سعر', 'بكم', 'بچم',
  'اشتري', 'أشتري', 'شراء',
  'دەمەوێ', 'دەمەوه', 'دەیدەم', 'داوام هەیە',
  'دەیوێ', 'دەمەوێت', 'بۆم بنێرە', 'بنێرە',
  'کڕین', 'کڕینی', 'چەندە', 'چەند',
  'ez dixwazim', 'dixwazim', 'sipariş',
  'want', 'order', 'buy', 'need', 'i need', 'i want'
];

// ─── Phone number patterns ──────────────────────────────────────────────────
const PHONE_PATTERNS = [
  /\+?\d{1,4}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{0,4}/,
  /\b0[1-9]\d{8,10}\b/,
  /(?:رقم(?:ي)?|هاتف(?:ي)?|موبايل(?:ي)?|تلفون(?:ي)?|جوال(?:ي)?|phone|mobile|tel|ژمارە|ژمارا)\s*:?\s*([+\d\s-]{7,15})/i,
];

// ─── Address patterns (Heavily Expanded for Badini/Sorani) ───────────────────
const ADDRESS_KEYWORDS = [
  'العنوان', 'عنواني', 'عنوان', 'المنطقة', 'منطقة', 'الحي', 'حي',
  'شارع', 'زنقة', 'محلة', 'قرب', 'بجانب', 'خلف', 'أمام', 'مقابل',
  'ناحية', 'قضاء', 'محافظة', 'مدينة', 'بغداد', 'بصرة', 'أربيل',
  'سليمانية', 'نينوى', 'موصل', 'كركوك', 'نجف', 'كربلاء',
  'address', 'street', 'area', 'district', 'city',
  // Kurdish (Sorani & Badini)
  'ناونیشان', 'شەقام', 'گەڕەک', 'تاخێ', 'تاخ', 'باژێر', 'جهـ', 'مال',
  'دهۆک', 'زاخۆ', 'هەولێر', 'سلێمانی', 'ئامێدی', 'شێلادزێ', 'ئاکرێ', 'سێمێل', 'کەرکوک', 'هەڵەبجە'
];

// ─── Name patterns ────────────────────────────────────────────────────────────
const NAME_PATTERNS = [
  /(?:اسمي|الاسم|اسم)\s*:?\s*(.{2,30})/,
  /(?:name|my name)\s*:?\s*(.{2,30})/i,
  /(?:ناوم|ناو|ناڤ)\s*:?\s*(.{2,30})/,
];

// ─── Size patterns ──────────────────────────────────────────────────────────
const SIZE_PATTERNS = [
  /\b(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl)\b/i,
  /(صغير|صغيرة|وسط|وسطي|كبير|كبيرة|كبيرجداً|كبير جداً)/,
  /(بچووک|ناوەند|مەزن|زۆر مەزن|گەورە)/,
  /مقاس\s*(\w+)/i,
  /سایز\s*(\w+)/i,
  /size\s*(\w+)/i,
];

// ─── Quantity patterns ──────────────────────────────────────────────────────
const QUANTITY_PATTERNS = [
  /(?:qty|quantity|الكمية|عدد|هژمار)\s*:?\s*(\d+)/i,
  /(\d+)\s*(حبة|حبات|قطعة|قطع|عدد|كيلو|كيلوغرام)/,
  /(\d+)\s*(دانه|دانەی|دانە|پارچه|پارچە)/,
  /(?:دانه|دانەی|دانە|پارچه|پارچە)\s*(\d+)/, // e.g. "دانە 2" -> match[1] will be "2"
  /(\d+)\s*(pieces?|items?|units?|kg|kilo)/i,
  /(\d+)x\s/i,
  /(واحد|واحدة)/,
  /(یەک|ئێک)/,
];

// ─── Color patterns (Expanded for Badini & Iraqi Dialects) ───────────────────
const COLOR_PATTERNS = [
  /(أحمر|احمر|أزرق|ازرق|أخضر|اخضر|أصفر|اصفر|أبيض|ابيض|أسود|اسود|بنفسجي|وردي|زهري|بني|رمادي|برتقالي|ذهبي|فضي)/,
  // Iraqi dialects
  /(رصاصي|ماروني|بصلي|نيلي|جوزي|خاكي|زيتوني|كحلي)/,
  // Kurdish Badini & Sorani
  /(سوور|سۆر|شین|سەوز|کەسک|زەرد|زەر|سپی|ڕەش|رەش|مۆر|پەمبە|پەمبەیی|قاوەیی|خاکستری|نارنجی|زێڕین|بۆز)/,
  /\b(red|blue|green|yellow|white|black|purple|pink|brown|gray|grey|orange|gold|silver)\b/i,
];

// ─── Product Keywords ─────────────────────────────────────────────────────────
const PRODUCT_KEYWORDS = [
  'تيشيرت', 'قميص', 'بنطلون', 'فستان', 'حذاء', 'شوز', 'تي شرت', 'سويتر',
  'کراس', 'پانتۆڵ', 'پێڵاو', 'کلاو', 'کەمەر', 'جل', 'بلووز', 'چاکەت',
  'shirt', 't-shirt', 'pants', 'shoes', 'dress', 'zara', 'nike', 'adidas'
];

// ─── Extraction Functions ─────────────────────────────────────────────────────

function isOrderMessage(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ORDER_KEYWORDS.some(keyword => lower.includes(keyword.toLowerCase()));
}

function extractPhone(text) {
  const normalized = normalizeDigits(text);
  for (const pattern of PHONE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      const phone = (match[1] || match[0]).replace(/[\s-]/g, '').trim();
      if (phone.length >= 7 && phone.length <= 15) return phone;
    }
  }
  const digitSequence = normalized.match(/\+?\d[\d\s-]{6,14}\d/);
  if (digitSequence) {
    const phone = digitSequence[0].replace(/[\s-]/g, '');
    if (phone.length >= 7 && phone.length <= 15) return phone;
  }
  return '';
}

function extractAddress(text) {
  // Check explicit labels
  const regexLabels = new RegExp(`(?:${ADDRESS_KEYWORDS.slice(0, 15).join('|')})\\s*:?\\s*(.{3,80})`, 'i');
  let match = text.match(regexLabels);
  if (match) return match[1].split('\n')[0].trim();

  // Look for any line containing a city or area keyword
  const lines = text.split('\n');
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const hasCity = ADDRESS_KEYWORDS.some(city => lowerLine.includes(city.toLowerCase()));
    
    // Make sure it's not a phone line or name line
    const isPhone = line.match(/\d{7,}/);
    const isGreeting = line.match(/سلاڤ|سڵاو|hello|مرحبا/i);
    
    if (hasCity && !isPhone && !isGreeting) {
      return line.trim();
    }
  }
  return '';
}

function extractName(text) {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let name = match[1].split('\n')[0].trim();
      name = name.replace(/(?:رقم|هاتف|موبايل|عنوان|phone|address).*/i, '').trim();
      if (name.length >= 2 && name.length <= 40) return name;
    }
  }

  // Fallback: Look at the first 3 lines. If it's 2-4 words and no numbers, it's probably the name
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i];
    // Exclude if it has digits
    if (/\d/.test(line)) continue;
    // Exclude greetings and address/product keywords
    const lower = line.toLowerCase();
    const rejectWords = ['slav', 'سلاو', 'سلاڤ', 'مرحبا', 'hello', 'hi', 'address', 'phone', 'qty', 'size', 'color', 'تاخێ', 'جهـ', 'کراس'];
    if (rejectWords.some(w => lower.includes(w))) continue;
    
    const words = line.trim().split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      return line;
    }
  }
  return '';
}

function extractQuantity(text) {
  const normalized = normalizeDigits(text);
  for (const pattern of QUANTITY_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      if (match[0].includes('واحد') || match[0].includes('یەک') || match[0].includes('ئێک')) return '1';
      return match[1] || match[2] || '1'; // match[2] catches the "دانە 2" reverse format
    }
  }
  return '1';
}

function extractSize(text) {
  for (const pattern of SIZE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1] || match[0];
  }
  return 'غير محدد';
}

function extractColor(text) {
  for (const pattern of COLOR_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return '';
}

function extractProduct(text) {
  // Look for any line containing a product keyword
  const lines = text.split('\n');
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const hasProduct = PRODUCT_KEYWORDS.some(p => lowerLine.includes(p.toLowerCase()));
    if (hasProduct) {
      return line.trim();
    }
  }
  return 'يرجى المراجعة';
}

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
    product: extractProduct(text),
    source: source,
    date: now.toLocaleDateString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    time: now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
    status: '🟡 جديد',
  };
  return order;
}

module.exports = { parseOrder, isOrderMessage };
