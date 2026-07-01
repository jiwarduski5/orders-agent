/**
 * conversationManager.js
 *
 * Pure Regex State Machine — No AI required.
 * Handles the full order flow for Instagram DMs.
 *
 * STATES:
 *   lang       → Show language selection (FIRST step)
 *   menu       → Show welcome menu, wait for 1 or 2
 *   ordering   → Send form, wait for filled form
 *   ordering_additional → Short form for 2nd+ orders (product + notes only)
 *   confirm    → Ask if user wants another order (yes/no)
 *   human      → Bot is completely silent, owner handles manually
 */

const { appendOrder } = require('./sheetsService');
const { sendInstagramReply } = require('./instagramReplyService');
const geminiService = require('./geminiService');

// ─── LANGUAGE PACKS ───────────────────────────────────────────────────────────
const LANG = {

  // ── BADINI KURDISH ──────────────────────────────────────────────────────────
  ku: {
    langSelected:
      ' ',

    welcome:
      'بخێرهاتی دێ چاوا شێم هاریکاریا تەکەم؟\n' +
      '━━━━━━━━━━━━━━━━\n' +
      '1: داخازیەکێ بکە\n' +
      '2: پەیوەندیێ بمە بکە\n' +
      '━━━━━━━━━━━━━━━━\n' +
      '  یەک یان دوو هەڵبژێرە بو بەردەوامبونێ',

    orderForm:
      ' گەلەک باشە! ئەڤێ فورمێ پر بکە و بۆمە بنێرە\n\n' +
      '━━━━━━━━━━━━━━━━━━\n' +
      'ناڤ:\n' +
      'ژمارا موبایلێ:\n' +
      'ناڤونیشان:\n' +
      'تە چجورە بەرهەم دڤێت:\n' +
      'تێبینی:\n' +
      '━━━━━━━━━━━━━━━━━━',

    additionalOrderForm:
      'گەلەک باشە\n' +
      '━━━━━━━━━━━━━━━━━━\n' +
      'تە چجورە بەرهەم دڤێت:\n' +
      'تێبینی:\n' +
      '━━━━━━━━━━━━━━━━━━',

    anotherOrder:
      'داخازیا تە هاتە وەرگرتن!\n' +
      'تە دڤێت داخازیەکا دیژی بکەی؟\n\n' +
      '1: بەلی\n' +
      '2: نەخێر',

    thankYou:
      'سوپاسیا تە دکەین!\n' +
      'داخازیاتە سەرکەفتیانە هاتە وەرگرتن\n' +
      'لنێزیک دێ پەیوەندیێ بتەکەین\n\n' +
      'ئەگەر تە دڤێت داخازیەکا نوی بکەی، ژمارە 1 بهەلبژێرە',

    humanMode:
      'بێ گومان! تیما مە دێ بەرسڤا تەبدەت\n' +
      ' چاڤەڕێ بە...',

    invalidChoice:
      'ببورە، تەنها یەک یان دوو هەڵبژێرە',

    invalidForm:
      'ببورە، فورمێ بدروستی پر بکە و دوبارە بنێرە\n\n' +
      '━━━━━━━━━━━━━━━━━━\n' +
      'ناڤ:\n' +
      'ژمارا موبایلێ:\n' +
      'ناڤونیشان:\n' +
      'تە چجورە بەرهەم دڤێت:\n' +
      'تێبینی:\n' +
      '━━━━━━━━━━━━━━━━━━',

    missingFields:
      'ببورە، هندەک بەش دکێمن! دوبارە پربکە\n\n' +
      '━━━━━━━━━━━━━━━━━━\n' +
      'ناڤ:\n' +
      'ژمارا موبایلێ:\n' +
      'ناڤونیشان:\n' +
      'تە چجورە بەرهەم دڤێت:\n' +
      'تێبینی:\n' +
      '━━━━━━━━━━━━━━━━━━',

    invalidYesNo:
      'ببورە، تەنها یەک یان دوو بهەڵبژێرە',

    restart:
      'باشە! دوبارە دەستپێدەکەین',

    cancelMsg:
      'داخازیا تە هاتە هەلوەشاندن\n' +
      'رۆژەکا خۆش بۆتە دخازین!',

    summaryHeader: 'کورتیا داخازیا تە:\n',
    summaryOrder: (i) => `──── داخازی #${i + 1} ────\n`,
    summaryName: 'ناڤ',
    summaryPhone: 'موبایل',
    summaryAddress: 'ناڤونیشان',
    summaryProduct: 'بەرهەم',
    summaryNotes: 'تێبینی',
    summaryReceived: 'هاتە وەرگرتن',

    errorMsg:
      'ببورە، کێشەک هەیە. دوبارە پربکە.',
  },

  // ── ARABIC ──────────────────────────────────────────────────────────────────
  ar: {
    langSelected:
      'تم اختيار العربية!\n' +
      'أهلاً وسهلاً!',

    welcome:
      ' مرحباً! كيف نقدر نساعدك؟\n\n' +
      '─────────────────────\n' +
      '1: أريد أطلب منتج\n' +
      '2: أريد أتواصل مع الفريق\n' +
      '─────────────────────\n' +
      ' اختر 1 أو 2',

    orderForm:
      ' ممتاز! أرسل لنا هذا النموذج\n\n' +
      '══════════════════════\n' +
      'الاسم:\n' +
      'رقم الهاتف:\n' +
      'العنوان:\n' +
      'المنتج المطلوب:\n' +
      'ملاحظات:\n' +
      '══════════════════════',

    additionalOrderForm:
      ' ممتاز!\n\n' +
      '══════════════════════\n' +
      'المنتج المطلوب:\n' +
      'ملاحظات:\n' +
      '══════════════════════',

    anotherOrder:
      ' تم استلام طلبك!\n' +
      'هل تريد إضافة طلب آخر؟\n\n' +
      '1: نعم\n' +
      '2: لا',

    thankYou:
      ' شكراً جزيلاً!\n' +
      'تم استلام طلباتك بنجاح\n' +
      'سنتواصل معك قريباً\n\n' +
      'إذا تريد تبدأ من جديد، أرسل رقم 1',

    humanMode:
      ' بالتأكيد! أحد من فريقنا سيرد عليك قريباً\n' +
      'تفضل بالانتظار...',

    invalidChoice:
      'عذراً، الرجاء اختيار 1 أو 2 فقط',

    invalidForm:
      'عذراً، الرجاء ملء جميع الحقول بشكل صحيح\n\n' +
      '══════════════════════\n' +
      'الاسم:\n' +
      'رقم الهاتف:\n' +
      'العنوان:\n' +
      'المنتج المطلوب:\n' +
      'ملاحظات:\n' +
      '══════════════════════',

    missingFields:
      ' يبدو أنك نسيت بعض الحقول، أعد التعبئة\n\n' +
      '══════════════════════\n' +
      'الاسم:\n' +
      'رقم الهاتف:\n' +
      'العنوان:\n' +
      'المنتج المطلوب:\n' +
      'ملاحظات:\n' +
      '══════════════════════',

    invalidYesNo:
      'عذراً، الرجاء الرد بـ 1 أو 2 فقط',

    restart:
      ' حسناً! لنبدأ من جديد',

    cancelMsg:
      'تم إلغاء طلبك\n' +
      'نتمنى لك يوماً سعيداً!',

    summaryHeader: 'ملخص طلبك:\n',
    summaryOrder: (i) => `──── طلب #${i + 1} ────\n`,
    summaryName: 'الاسم',
    summaryPhone: 'الهاتف',
    summaryAddress: 'العنوان',
    summaryProduct: 'المنتج',
    summaryNotes: 'ملاحظات',
    summaryReceived: 'تم الاستلام',

    errorMsg:
      'عذراً، حدث خطأ. حاول مرة أخرى.',
  },

  // ── ENGLISH ─────────────────────────────────────────────────────────────────
  en: {
    langSelected:
      ' English selected!\n' +
      'Welcome!',

    welcome:
      ' Hello! How can we help you today?\n\n' +
      '─────────────────────\n' +
      '1: I want to place an order\n' +
      '2: I want to contact the team\n' +
      '─────────────────────\n' +
      ' Reply with 1 or 2',

    orderForm:
      ' Great! Please fill this out and send it back\n\n' +
      '══════════════════════\n' +
      'Name:\n' +
      'Phone:\n' +
      'Address:\n' +
      'Product you want:\n' +
      'Notes:\n' +
      '══════════════════════',

    additionalOrderForm:
      ' Great!\n\n' +
      '══════════════════════\n' +
      'Product you want:\n' +
      'Notes:\n' +
      '══════════════════════',

    anotherOrder:
      ' Your order has been received!\n' +
      'Would you like to add another order?\n\n' +
      '1: Yes\n' +
      '2: No',

    thankYou:
      ' Thank you so much!\n' +
      'All your orders have been received\n' +
      'We will contact you soon\n\n' +
      'If you want to start again, send number 1',

    humanMode:
      ' Of course! Our team will reply to you shortly\n' +
      'Please wait...',

    invalidChoice:
      'Sorry, please reply with 1 or 2 only',

    invalidForm:
      'Sorry, please fill all fields correctly\n\n' +
      '══════════════════════\n' +
      'Name:\n' +
      'Phone:\n' +
      'Address:\n' +
      'Product you want:\n' +
      'Notes:\n' +
      '══════════════════════',

    missingFields:
      ' Oops, looks like some fields are missing\n\n' +
      '══════════════════════\n' +
      'Name:\n' +
      'Phone:\n' +
      'Address:\n' +
      'Product you want:\n' +
      'Notes:\n' +
      '══════════════════════',

    invalidYesNo:
      'Sorry, please reply with 1 or 2 only',

    restart:
      ' Ok! Let\'s start again',

    cancelMsg:
      'Your order has been cancelled\n' +
      'Have a great day!',

    summaryHeader: 'Your order summary:\n',
    summaryOrder: (i) => `──── Order #${i + 1} ────\n`,
    summaryName: 'Name',
    summaryPhone: 'Phone',
    summaryAddress: 'Address',
    summaryProduct: 'Product',
    summaryNotes: 'Notes',
    summaryReceived: 'Received',

    errorMsg:
      'Sorry, something went wrong. Please try again.',
  },
};

// ─── LANGUAGE SELECTION MENU (shown to EVERY new user) ────────────────────────
const LANG_SELECT_MSG =
  'زمانێ خۆ هەڵبژێرە\n' +
  '━━━━━━━━━━━━━━━━━━\n' +
  '1: Kurdish\n' +
  '2: Arabic\n' +
  '3: English\n' +
  '━━━━━━━━━━━━━━━━━━\n' +
  'Her bijêre!';

// ─── AI GREETINGS (shown after language selection when AI is enabled) ─────────
const AI_GREETINGS = {
  ku: 'بخێرهاتی! ئەز هاریکارا تەمە. چاوا دشێم هاریکاریا تەکەم؟',
  ar: 'أهلاً وسهلاً! أنا هنا لمساعدتك. كيف أقدر أساعدك؟',
  en: 'Hey there! I\'m here to help you out. How can I help?',
};

// ─── CONVERSATIONS STORE ──────────────────────────────────────────────────────
const sessionStore = require('./sessionStore');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function typingDelay(text) {
  const base = 800;
  const extra = Math.min(text.length * 5, 1200);
  return new Promise(resolve => setTimeout(resolve, base + extra));
}

function getLangPack(convo) {
  return LANG[convo.lang] || LANG.ku;
}

function getLangChoice(text) {
  const t = text.trim();
  if (['1', '١', '1️⃣'].includes(t) || t.startsWith('1')) return 'ku';
  if (['2', '٢', '2️⃣'].includes(t) || t.startsWith('2')) return 'ar';
  if (['3', '٣', '3️⃣'].includes(t) || t.startsWith('3')) return 'en';
  return null;
}

function isYes(text) {
  const t = text.trim().toLowerCase();
  return ['1', '١', '1️⃣', 'one', '١️⃣', 'بەلی', 'بەلێ', 'بلی', 'بله', 'بلا', 'نعم', 'اه', 'آه', 'اي',
    'yes', 'yeah', 'yep', 'y', 'ok', 'okay', 'باشە', 'ئوکەی',
    'bale', 'erê', 'ere'].includes(t) || t.startsWith('1') || t.startsWith('١');
}

function isNo(text) {
  const t = text.trim().toLowerCase();
  return ['2', '٢', '2️⃣', 'two', '٢️⃣', 'نەخێر', 'نه', 'لا', 'no', 'nope', 'n', 'نا', 'خێر',
    'na', 'nê', 'ne'].includes(t) || t.startsWith('2') || t.startsWith('٢');
}

function isRestart(text) {
  const t = text.trim().toLowerCase();
  return ['دەستپیک', 'menu', 'restart', 'start', 'ابدأ', 'رجوع',
    'back', 'باك', 'قائمة', 'قايمة', 'زمان', 'lang', 'language'].includes(t);
}

function isCancel(text) {
  const t = text.trim().toLowerCase();
  return ['stop', 'cancel', 'الغاء', 'إلغاء', 'راوەستان', 'بەسە', 'بەس', 'قفل', 'بەطال', 'بطال'].includes(t);
}

function getMenuChoice(text) {
  const t = text.trim();
  if (['1', '١', '1️⃣'].includes(t) || t.startsWith('1') || t.startsWith('١')) return '1';
  if (['2', '٢', '2️⃣'].includes(t) || t.startsWith('2') || t.startsWith('٢')) return '2';
  return null;
}

function parseFilledForm(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // IMPORTANT: Longer/more specific labels FIRST to avoid partial matches
  const labels = {
    name: [
      '👤 ناڤ', '👤 الاسم', '👤 Name', '👤 name',
      'ناڤ', 'ناو', 'الاسم', 'اسم', 'name',
    ],
    phone: [
      '📱 ژمارا موبایلێ', '📱 رقم الهاتف', '📱 Phone', '📱 phone',
      'ژمارا موبایلێ', 'ژمارا', 'موبایل', 'رقم الهاتف', 'هاتف', 'phone', 'mobile', 'tel',
    ],
    address: [
      '📍 ناڤونیشان', '📍 العنوان', '📍 Address', '📍 address',
      'ناڤونیشان', 'ناونیشان', 'العنوان', 'عنوان', 'address',
    ],
    product: [
      '📦 بەرهەمێ دڤێت', '📦 المنتج المطلوب', '📦 Product you want',
      '📦 بەرهەم', '📦 المنتج', '📦 product',
      'تە چ جورە بەرهەم دڤێت', 'بەرهەمێ دڤێت', 'بەرهەم',
      'المنتج المطلوب', 'المنتج', 'منتج',
      'Product you want', 'product you want', 'product',
    ],
    notes: [
      '📝 تێبینی', '📝 ملاحظات', '📝 Notes', '📝 notes',
      'تێبینی', 'تیبینی', 'ملاحظات', 'ملاحظه', 'notes', 'note',
    ],
  };

  const result = { name: '', phone: '', address: '', product: '', notes: '' };

  for (const line of lines) {
    for (const [field, variants] of Object.entries(labels)) {
      for (const label of variants) {
        const regex = new RegExp(`^${escapeRegex(label)}\\s*[:\\/]?\\s*(.*)`, 'i');
        const match = line.match(regex);
        if (match && match[1].trim().length > 0 && !result[field]) {
          result[field] = match[1].trim();
          break;
        }
      }
    }
  }

  // Positional fallback (user sent values only, line by line)
  const hasAnyLabel = Object.values(result).some(v => v.length > 0);
  if (!hasAnyLabel && lines.length >= 4) {
    result.name    = lines[0] || '';
    result.phone   = lines[1] || '';
    result.address = lines[2] || '';
    result.product = lines[3] || '';
    result.notes   = lines[4] || '';
  }

  const valid = result.name.length > 0 && result.phone.length > 0 && result.product.length > 0;
  return valid ? result : null;
}

function parseAdditionalForm(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const labels = {
    product: [
      '📦 بەرهەمێ دڤێت', '📦 المنتج المطلوب', '📦 Product you want',
      '📦 بەرهەم', '📦 المنتج', '📦 product',
      'تە چ جورە بەرهەم دڤێت', 'تە چجورە بەرهەم دڤێت', 'بەرهەمێ دڤێت', 'بەرهەم',
      'المنتج المطلوب', 'المنتج', 'منتج',
      'Product you want', 'product you want', 'product',
    ],
    notes: [
      '📝 تێبینی', '📝 ملاحظات', '📝 Notes', '📝 notes',
      'تێبینی', 'تیبینی', 'ملاحظات', 'ملاحظه', 'notes', 'note',
    ],
  };

  const result = { product: '', notes: '' };

  for (const line of lines) {
    for (const [field, variants] of Object.entries(labels)) {
      for (const label of variants) {
        const regex = new RegExp(`^${escapeRegex(label)}\\s*[:\\/]?\\s*(.*)`, 'i');
        const match = line.match(regex);
        if (match && match[1].trim().length > 0 && !result[field]) {
          result[field] = match[1].trim();
          break;
        }
      }
    }
  }

  // Positional fallback: if no labels found, first line = product, second = notes
  const hasAnyLabel = Object.values(result).some(v => v.length > 0);
  if (!hasAnyLabel && lines.length >= 1) {
    result.product = lines[0] || '';
    result.notes   = lines[1] || '';
  }

  return result.product.length > 0 ? result : null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSummary(ordersList, L) {
  let summary = L.summaryHeader + '\n';
  ordersList.forEach((order, i) => {
    summary += L.summaryOrder(i);
    summary += `${L.summaryName}: ${order.name}\n`;
    summary += `${L.summaryPhone}: ${order.phone}\n`;
    summary += `${L.summaryAddress}: ${order.address}\n`;
    summary += `${L.summaryProduct}: ${order.product}\n`;
    if (order.notes && order.notes !== '—') {
      summary += `${L.summaryNotes}: ${order.notes}\n`;
    }
    summary += '\n';
  });
  summary += L.summaryReceived;
  return summary;
}

function buildTelegramNotification(senderId, ordersList, orderStartNumber, lang) {
  const now = new Date();
  const date = now.toLocaleDateString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
  const langLabel = { ku: '🇮🇶 Badini Kurdish', ar: '🇸🇦 Arabic', en: '🇬🇧 English' }[lang] || 'Unknown';

  let msg = `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `<b>NEW ORDER SESSION</b>\n`;
  msg += `<b>IG User:</b> user_${senderId}\n`;
  msg += `<b>Language:</b> ${langLabel}\n`;
  msg += `<b>Date:</b> ${date} - ${time}\n`;
  msg += `<b>Total Orders:</b> ${ordersList.length}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  ordersList.forEach((order, i) => {
    msg += ` Order #${orderStartNumber + i} \n`;
    msg += `<b>Name:</b> ${order.name || '⚠️ MISSING'}\n`;
    msg += `<b>Phone:</b> ${order.phone || '⚠️ MISSING'}\n`;
    msg += `<b>Address:</b> ${order.address || '⚠️ MISSING'}\n`;
    msg += `<b>Product:</b> ${order.product || '⚠️ MISSING'}\n`;
    msg += `<b>Notes:</b> ${order.notes || '—'}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━━`;
  return msg;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

async function handleNewMessage(pageId, senderId, messageText, messageId) {
  if (!messageText || !messageText.trim()) return;

  let convo = await sessionStore.get(pageId, senderId);
  if (!convo) {
    convo = {
      state: 'lang',   // ← ALWAYS starts at lang selection
      lang: null,
      orders: [],
      messageIds: new Set(),
    };
    await sessionStore.set(pageId, senderId, convo);
    console.log(`New session: ${senderId}`);
  }

  if (convo.messageIds.has(messageId)) return;
  convo.messageIds.add(messageId);

  if (convo.messageIds.size > 50) {
    const first = convo.messageIds.values().next().value;
    convo.messageIds.delete(first);
  }

  const text = messageText.trim();
  console.log(`${senderId.slice(0,12)}... | ${convo.state} | "${text.slice(0,40)}"`);

  if (isRestart(text)) {
    convo.state = 'lang';
    convo.lang  = null;
    convo.orders = [];
    convo.chatHistory = [];
    convo.currentSlots = { name: null, phone: null, address: null, product: null, notes: null };
    console.log(`${senderId.slice(0,12)}... restarted`);
    await sessionStore.set(pageId, senderId, convo);
    await typingDelay(LANG_SELECT_MSG);
    await sendInstagramReply(pageId, senderId, LANG_SELECT_MSG);
    return;
  }

  // ── CANCEL KEYWORD — clears the session entirely ────────────────────────────
  if (isCancel(text)) {
    const L = convo.lang ? getLangPack(convo) : LANG.ku;
    const cancelText = L.cancelMsg;
    await sessionStore.delete(pageId, senderId);
    console.log(`${senderId.slice(0,12)}... cancelled`);
    await typingDelay(cancelText);
    await sendInstagramReply(pageId, senderId, cancelText);
    return;
  }

  if (convo.state === 'human') {
    await sessionStore.set(pageId, senderId, convo);
    console.log(`${senderId.slice(0,12)}... human mode`);
    return;
  }

  // ── STATE: finished ─────────────────────────────────────────────────────────
  if (convo.state === 'finished') {
    const t = text.trim();
    if (t === '1' || t === '١' || isRestart(t)) {
      if (geminiService.isAIEnabled()) {
        convo.state = 'ai_chat';
        convo.orders = [];
        convo.chatHistory = [];  // EMPTY — first real user message becomes first entry
        convo.currentSlots = { name: null, phone: null, address: null, product: null, notes: null };
        const greeting = AI_GREETINGS[convo.lang] || AI_GREETINGS.en;
        console.log(`${senderId.slice(0,12)}... restarted (AI mode)`);
        await sessionStore.set(pageId, senderId, convo);
        await typingDelay(greeting);
        await sendInstagramReply(pageId, senderId, greeting);
      } else {
        convo.state = 'menu';
        convo.orders = [];
        console.log(`${senderId.slice(0,12)}... restarted`);
        await sessionStore.set(pageId, senderId, convo);
        const L = getLangPack(convo);
        await typingDelay(L.welcome);
        await sendInstagramReply(pageId, senderId, L.welcome);
      }
    } else {
      console.log(`${senderId.slice(0,12)}... finished — silent for "${text.slice(0,30)}"`);
      await sessionStore.set(pageId, senderId, convo); // just save messageId
    }
    return;
  }

  // ── STATE: lang ──────────────────────────────────────────────────────────────
  if (convo.state === 'lang') {
    const chosen = getLangChoice(text);

    if (chosen) {
      convo.lang = chosen;

      if (geminiService.isAIEnabled()) {
        convo.state = 'ai_chat';
        convo.chatHistory = [];
        convo.currentSlots = { name: null, phone: null, address: null, product: null, notes: null };
        const greeting = AI_GREETINGS[chosen] || AI_GREETINGS.en;
        console.log(`${senderId.slice(0,12)}... lang=${chosen} (AI)`);
        await sessionStore.set(pageId, senderId, convo);
        await typingDelay(greeting);
        await sendInstagramReply(pageId, senderId, greeting);
      } else {
        convo.state = 'menu';
        const L = getLangPack(convo);
        console.log(`${senderId.slice(0,12)}... lang=${chosen} (regex)`);
        await sessionStore.set(pageId, senderId, convo);
        await typingDelay(L.langSelected);
        await sendInstagramReply(pageId, senderId, L.langSelected + '\n\n' + L.welcome);
      }
    } else {
      console.log(`${senderId.slice(0,12)}... showing language menu`);
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(LANG_SELECT_MSG);
      await sendInstagramReply(pageId, senderId, LANG_SELECT_MSG);
    }
    return;
  }

  // ── STATE: ai_chat (Gemini AI handles the conversation naturally) ───────────
  if (convo.state === 'ai_chat') {
    await handleAIChat(pageId, senderId, text, convo);
    return;
  }

  const L = getLangPack(convo);

  // ── STATE: menu ─────────────────────────────────────────────────────────────
  if (convo.state === 'menu') {
    const choice = getMenuChoice(text);

    if (choice === '1') {
      convo.state = 'ordering';
      console.log(`${senderId.slice(0,12)}... wants to order`);
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(L.orderForm);
      await sendInstagramReply(pageId, senderId, L.orderForm);

    } else if (choice === '2') {
      convo.state = 'human';
      console.log(`${senderId.slice(0,12)}... wants human`);
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(L.humanMode);
      await sendInstagramReply(pageId, senderId, L.humanMode);

    } else {
      console.log(`${senderId.slice(0,12)}... showing menu again`);
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(L.welcome);
      await sendInstagramReply(pageId, senderId, L.welcome);
    }
    return;
  }

  if (convo.state === 'ordering') {
    const parsed = parseFilledForm(text);

    if (!parsed) {
      const hasAnyContent = text.length > 20;
      const reply = hasAnyContent ? L.missingFields : L.invalidForm;
      console.log(`${senderId.slice(0,12)}... form invalid`);
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(reply);
      await sendInstagramReply(pageId, senderId, reply);
      return;
    }

    const isDuplicate = await sessionStore.hasOrderedRecently(pageId, parsed.phone, parsed.product);
    if (isDuplicate) {
      console.log(`${senderId.slice(0,12)}... duplicate: ${parsed.phone}`);
      const duplicateMsg = 
        convo.lang === 'ku' ? 'ببورە، ئەڤ ژمارەیە پێشتر داخازیەک کریە. چاڤەڕێ بکە تا پەیوەندیێ بتەکەین.' :
        convo.lang === 'ar' ? 'عذراً، هذا الرقم طلب مسبقاً. ننتظر حتى نتواصل معك.' :
        'Sorry, this number already placed an order recently. We will contact you soon.';
      
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(duplicateMsg);
      await sendInstagramReply(pageId, senderId, duplicateMsg);
      return;
    }

    convo.orders.push({
      name:    parsed.name,
      phone:   parsed.phone,
      address: parsed.address,
      product: parsed.product,
      notes:   parsed.notes || '—',
    });

    console.log(`${senderId.slice(0,12)}... order #${convo.orders.length} collected`);
    convo.state = 'confirm';
    await sessionStore.set(pageId, senderId, convo);
    await typingDelay(L.anotherOrder);
    await sendInstagramReply(pageId, senderId, L.anotherOrder);
    return;
  }

  if (convo.state === 'ordering_additional') {
    const additionalParsed = parseAdditionalForm(text);

    if (!additionalParsed) {
      console.log(`${senderId.slice(0,12)}... additional form invalid`);
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(L.additionalOrderForm);
      await sendInstagramReply(pageId, senderId, L.additionalOrderForm);
      return;
    }

    const firstOrder = convo.orders[0];

    const isDuplicate = await sessionStore.hasOrderedRecently(pageId, firstOrder.phone, additionalParsed.product);
    if (isDuplicate) {
      console.log(`${senderId.slice(0,12)}... duplicate product: ${additionalParsed.product}`);
      const duplicateMsg = 
        convo.lang === 'ku' ? 'ببورە، ئەڤ بەرهەمە پێشتر داخازی کریە.' :
        convo.lang === 'ar' ? 'عذراً، هذا المنتج تم طلبه مسبقاً.' :
        'Sorry, this product was already ordered.';
      
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(duplicateMsg);
      await sendInstagramReply(pageId, senderId, duplicateMsg);
      return;
    }

    convo.orders.push({
      name:    firstOrder.name,
      phone:   firstOrder.phone,
      address: firstOrder.address,
      product: additionalParsed.product,
      notes:   additionalParsed.notes || '—',
    });

    console.log(`${senderId.slice(0,12)}... additional order #${convo.orders.length} collected`);
    convo.state = 'confirm';
    await sessionStore.set(pageId, senderId, convo);
    await typingDelay(L.anotherOrder);
    await sendInstagramReply(pageId, senderId, L.anotherOrder);
    return;
  }

  if (convo.state === 'confirm') {
    if (isYes(text)) {
      convo.state = 'ordering_additional';
      console.log(`${senderId.slice(0,12)}... wants another order`);
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(L.additionalOrderForm);
      await sendInstagramReply(pageId, senderId, L.additionalOrderForm);

    } else if (isNo(text)) {
      console.log(`${senderId.slice(0,12)}... done — saving ${convo.orders.length} order(s)`);
      await finalizeAllOrders(pageId, senderId, convo, L);

    } else {
      console.log(`${senderId.slice(0,12)}... invalid yes/no`);
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(L.invalidYesNo);
      await sendInstagramReply(pageId, senderId, L.invalidYesNo);
    }
    return;
  }
}

// ─── FINALIZE ALL ORDERS ──────────────────────────────────────────────────────

async function finalizeAllOrders(pageId, senderId, convo, L) {
  const now = new Date();
  const date = now.toLocaleDateString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

  let firstOrderNumber = null;

  try {
    for (let i = 0; i < convo.orders.length; i++) {
      const order = convo.orders[i];

      const sheetOrder = {
        isOrder: true,
        customer: `user_${senderId}`,
        customerName: order.name,
        phone: order.phone,
        address: order.address,
        product: order.product,
        quantity: '1',
        size: '—',
        color: '—',
        rawMessage: `Name: ${order.name}\nPhone: ${order.phone}\nAddress: ${order.address}\nProduct: ${order.product}\nNotes: ${order.notes}`,
        source: 'DM',
        date,
        time,
        status: '🟡 جديد',
      };

      const orderNumber = await appendOrder(pageId, sheetOrder);
      if (i === 0) firstOrderNumber = orderNumber;
      
      // Record phone number and product in duplicate guard
      await sessionStore.recordPhone(pageId, order.phone, order.product);
      
      console.log(`${senderId.slice(0,12)}... order #${i + 1} saved`);
    }

    const telegramMsg = buildTelegramNotification(senderId, convo.orders, firstOrderNumber, convo.lang);
    const { sendTelegram } = require('./telegramService');
    await sendTelegram(pageId, telegramMsg);

    const summary = buildSummary(convo.orders, L);
    await typingDelay(summary);
    await sendInstagramReply(pageId, senderId, summary);

    await new Promise(resolve => setTimeout(resolve, 800));
    await sendInstagramReply(pageId, senderId, L.thankYou);

    console.log(`${senderId.slice(0,12)}... all ${convo.orders.length} order(s) done`);

  } catch (err) {
    console.error(`${senderId.slice(0,12)}... failed:`, err.message);
    await sendInstagramReply(pageId, senderId, L.errorMsg);
  } finally {
    convo.state = 'finished';
    convo.orders = [];
    await sessionStore.set(pageId, senderId, convo);
    console.log(`${senderId.slice(0,12)}... session complete`);
  }
}

// ─── AI CHAT HANDLER ──────────────────────────────────────────────────────────

async function handleAIChat(pageId, senderId, text, convo) {
  try {

    const result = await geminiService.processMessage(
      convo.lang,
      convo.chatHistory || [],
      convo.currentSlots || { name: null, phone: null, address: null, product: null, notes: null },
      convo.orders.length,
      text
    );

    // Update chat history
    convo.chatHistory = result.updatedHistory;

    // Update slots — merge extracted data (never overwrite with null)
    if (result.extracted) {
      const slots = convo.currentSlots || { name: null, phone: null, address: null, product: null, notes: null };
      if (result.extracted.name) slots.name = result.extracted.name;
      if (result.extracted.phone) slots.phone = result.extracted.phone;
      if (result.extracted.address) slots.address = result.extracted.address;
      if (result.extracted.product) slots.product = result.extracted.product;
      if (result.extracted.notes) slots.notes = result.extracted.notes;
      convo.currentSlots = slots;
    }

    console.log(`${senderId.slice(0,12)}... AI: ${result.action} | ${['name','phone','address','product'].filter(k => convo.currentSlots?.[k]).length}/4 slots`);

    if (result.action === 'order_confirmed') {
      const order = {
        name: convo.currentSlots.name,
        phone: convo.currentSlots.phone,
        address: convo.currentSlots.address,
        product: convo.currentSlots.product,
        notes: convo.currentSlots.notes || '—',
      };
      convo.orders.push(order);

      convo.currentSlots.product = null;
      convo.currentSlots.notes = null;

      console.log(`${senderId.slice(0,12)}... AI order #${convo.orders.length}: ${order.product}`);

      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(result.reply);
      await sendInstagramReply(pageId, senderId, result.reply);

    } else if (result.action === 'no_more_orders') {
      console.log(`${senderId.slice(0,12)}... AI: done — ${convo.orders.length} order(s)`);

      await typingDelay(result.reply);
      await sendInstagramReply(pageId, senderId, result.reply);

      if (convo.orders.length > 0) {
        await finalizeOrdersAI(pageId, senderId, convo);
      } else {
        convo.state = 'finished';
        convo.chatHistory = [];
        convo.currentSlots = { name: null, phone: null, address: null, product: null, notes: null };
        await sessionStore.set(pageId, senderId, convo);
      }

    } else if (result.action === 'human') {
      convo.state = 'human';
      console.log(`${senderId.slice(0,12)}... AI: switching to human mode`);
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(result.reply);
      await sendInstagramReply(pageId, senderId, result.reply);

    } else {
      await sessionStore.set(pageId, senderId, convo);
      await typingDelay(result.reply);
      await sendInstagramReply(pageId, senderId, result.reply);
    }

  } catch (err) {
    console.error(`${senderId.slice(0,12)}... Gemini error:`, err.message);

    const errorMsg = {
      ku: 'ببورە، کێشەیەک هەبوو. دوبارە بنێرە.',
      ar: 'عذراً، حدث خطأ. حاول مرة أخرى.',
      en: 'Sorry, something went wrong. Please try again.',
    }[convo.lang] || 'Sorry, please try again.';

    await sessionStore.set(pageId, senderId, convo);
    await sendInstagramReply(pageId, senderId, errorMsg);
  }
}

// ─── FINALIZE ORDERS (AI MODE) ────────────────────────────────────────────────

async function finalizeOrdersAI(pageId, senderId, convo) {
  const now = new Date();
  const date = now.toLocaleDateString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

  let firstOrderNumber = null;

  try {
    for (let i = 0; i < convo.orders.length; i++) {
      const order = convo.orders[i];

      const sheetOrder = {
        isOrder: true,
        customer: `user_${senderId}`,
        customerName: order.name,
        phone: order.phone,
        address: order.address,
        product: order.product,
        quantity: '1',
        size: '—',
        color: '—',
        rawMessage: `Name: ${order.name}\nPhone: ${order.phone}\nAddress: ${order.address}\nProduct: ${order.product}\nNotes: ${order.notes}`,
        source: 'DM (AI)',
        date,
        time,
        status: '🟡 جديد',
      };

      const orderNumber = await appendOrder(pageId, sheetOrder);
      if (i === 0) firstOrderNumber = orderNumber;

      // Record phone for duplicate guard
      await sessionStore.recordPhone(pageId, order.phone, order.product);

      console.log(`${senderId.slice(0,12)}... AI order #${i + 1} saved`);
    }

    const telegramMsg = buildTelegramNotification(senderId, convo.orders, firstOrderNumber, convo.lang);
    const { sendTelegram } = require('./telegramService');
    await sendTelegram(pageId, telegramMsg);

    console.log(`${senderId.slice(0,12)}... all ${convo.orders.length} AI order(s) done`);

  } catch (err) {
    console.error(`${senderId.slice(0,12)}... AI finalize failed:`, err.message);
  } finally {
    convo.state = 'finished';
    convo.orders = [];
    convo.chatHistory = [];
    convo.currentSlots = { name: null, phone: null, address: null, product: null, notes: null };
    await sessionStore.set(pageId, senderId, convo);
    console.log(`${senderId.slice(0,12)}... AI session complete`);
  }
}

module.exports = { handleNewMessage };