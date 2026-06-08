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
 *   confirm    → Ask if user wants another order (yes/no)
 *   human      → Bot is completely silent, owner handles manually
 */

const { appendOrder } = require('./sheetsService');
const { sendInstagramReply } = require('./instagramReplyService');

// ─── LANGUAGE PACKS ───────────────────────────────────────────────────────────
const LANG = {

  // ── BADINI KURDISH ──────────────────────────────────────────────────────────
  ku: {
    langSelected:
      'زمانێ کوردی هەڵبژارت!\n' +
      'بخێرهاتی!',

    welcome:
      'بخێرهاتی دێ چاوا شێم هاریکاریا تەکەم؟ \n\n' +
      '─────────────────────\n' +
      '1 داخازیەکێ بکە \n' +
      '2 پەیوەندیێ بمە بکە \n' +
      '─────────────────────\n' +
      '  ١ یان ٢ بنڤیسە',

    orderForm:
      ' گەلەک باشە! ئەڤێ فورمێ پر بکە و بۆمە بنێرە \n\n' +
      'ناڤ:\n' +
      'ژمارا موبایلێ:\n' +
      'ناڤونیشان:\n' +
      'تە چجورە بەرهەم دڤێت:\n' +
      'تێبینی:\n',
    

    anotherOrder:
      'داخازیا تە هاتە وەرگرتن!\n' +
      'تە دڤێت داخازیەکا دیژی بکەی؟ \n\n' +
      '1 بەلی\n' +
      '2 نەخێر',

    thankYou:
      'سوپاسیا تە دکەین!\n' +
      'داخازیاتە سەرکەفتیانە هاتە وەرگرتن \n' +
      'لنێزیک دێ پەیوەندیێ بتەکەین\n\n' +
      'ئەگەر تە دڤێت داخازیەکا نوی بکەی، ژمارە 1 بنڤیسە',

    humanMode:
      'بێ گومان! تیما مە دێ بەرسڤا تەبدەت \n' +
      ' چاڤەڕێ بە...',

    invalidChoice:
      '١ یان ٢ هەڵبژێرە ',

    invalidForm:
      'فورمێ بدروستی پر بکە و دوبارە بنێرە \n\n' +
      'ناڤ:\n' +
      'ژمارا موبایلێ:\n' +
      'ناڤونیشان:\n' +
      'تە چجورە بەرهەم دڤێت:\n' +
      'تێبینی:\n',

    missingFields:
      'هندەک بەش دکێمن ! دوبارە پربکە\n\n' +
      'ناڤ:\n' +
      'ژمارا موبایلێ:\n' +
      'ناڤونیشان:\n' +
      'تە چجورە بەرهەم دڤێت:\n' +
      'تێبینی:\n',

    invalidYesNo:
      '١ یان ٢ بنڤیسە ',

    restart:
      'باشە! دوبارە دەستپێدەکەین',

    cancelMsg:
      'داخازیا تە هاتە هەلوەشاندن. رۆژەکا خۆش بۆتە دخازین! 👋',

    summaryHeader: 'کورتیا داخازیا تە:\n',
    summaryOrder: (i) => `──── داخازی #${i + 1} ────\n`,
    summaryName: ' ناڤ',
    summaryPhone: 'موبایل',
    summaryAddress: 'ناڤونیشان',
    summaryProduct: 'تە چجورە بەرهەم دڤێت',
    summaryNotes: 'تێبینی',
    summaryReceived: ' هاتە وەرگرتن',

    errorMsg:
      ' ببورە. دوبارە پربکە.',
  },

  // ── ARABIC ──────────────────────────────────────────────────────────────────
  ar: {
    langSelected:
      'تم اختيار اللغة العربية!\n' +
      'أهلاً وسهلاً!',

    welcome:
      ' مرحباً! كيف نقدر نساعدك؟ \n\n' +
      '─────────────────────\n' +
      '1  أريد أطلب منتج \n' +
      '2  أريد أتواصل مع الفريق \n' +
      '─────────────────────\n' +
      ' اختر 1 أو 2',

    orderForm:
      ' ممتاز! أرسل لنا هذا النموذج \n\n' +
      '══════════════════════\n' +
      ' الاسم:\n' +
      ' رقم الهاتف:\n' +
      ' العنوان:\n' +
      ' المنتج المطلوب:\n' +
      ' ملاحظات:\n' +
      '══════════════════════',

    anotherOrder:
      ' تم استلام طلبك!\n' +
      'هل تريد إضافة طلب آخر؟ \n\n' +
      '1 نعم\n' +
      '2 لا',

    thankYou:
      ' شكراً جزيلاً!\n' +
      'تم استلام طلباتك بنجاح \n' +
      'سنتواصل معك قريباً \n\n' +
      'إذا كنت تريد البدء من جديد، أرسل رقم 1',

    humanMode:
      ' بالتأكيد! سيرد عليك أحد من فريقنا قريباً \n' +
      'تفضل بالانتظار...',

    invalidChoice:
      ' الرجاء اختيار 1 أو 2 فقط ',

    invalidForm:
      ' الرجاء ملء جميع الحقول بشكل صحيح وإعادة الإرسال \n\n' +
      '══════════════════════\n' +
      ' الاسم:\n' +
      ' رقم الهاتف:\n' +
      ' العنوان:\n' +
      ' المنتج المطلوب:\n' +
      ' ملاحظات:\n' +
      '══════════════════════',

    missingFields:
      ' يبدو أنك نسيت بعض الحقول، أعد التعبئة \n\n' +
      '══════════════════════\n' +
      ' الاسم:\n' +
      ' رقم الهاتف:\n' +
      ' العنوان:\n' +
      ' المنتج المطلوب:\n' +
      ' ملاحظات:\n' +
      '══════════════════════',

    invalidYesNo:
      ' الرجاء الرد بـ 1 أو 2 فقط ',

    restart:
      ' حسناً! لنبدأ من جديد ',

    cancelMsg:
      'تم إلغاء طلبك. نتمنى لك يوماً سعيداً! 👋',

    summaryHeader: ' ملخص طلبك:\n',
    summaryOrder: (i) => `──── الطلب #${i + 1} ────\n`,
    summaryName: ' الاسم',
    summaryPhone: ' الهاتف',
    summaryAddress: ' العنوان',
    summaryProduct: ' المنتج',
    summaryNotes: ' ملاحظات',
    summaryReceived: ' تم الاستلام',

    errorMsg:
      ' عذراً، حدث خطأ. حاول مرة أخرى.',
  },

  // ── ENGLISH ─────────────────────────────────────────────────────────────────
  en: {
    langSelected:
      ' English selected!\n' +
      'Welcome! ',

    welcome:
      ' Hello! How can we help you today? \n\n' +
      '─────────────────────\n' +
      '1  I want to place an order \n' +
      '2  I want to contact the team \n' +
      '─────────────────────\n' +
      ' Reply with 1 or 2',

    orderForm:
      ' Great! Please fill out this form and send it back \n\n' +
      '══════════════════════\n' +
      ' Name:\n' +
      ' Phone:\n' +
      ' Address:\n' +
      ' Product you want:\n' +
      ' Notes:\n' +
      '══════════════════════',

    anotherOrder:
      ' Your order has been received!\n' +
      'Would you like to add another order? \n\n' +
      '1 Yes\n' +
      '2 No',

    thankYou:
      ' Thank you so much!\n' +
      'All your orders have been received \n' +
      'We will contact you soon \n\n' +
      'If you want to start again, send number 1',

    humanMode:
      ' Of course! Our team will reply to you shortly \n' +
      'Please wait...',

    invalidChoice:
      ' Please reply with 1 or 2 only ',

    invalidForm:
      ' Please fill all fields correctly and send again \n\n' +
      '══════════════════════\n' +
      ' Name:\n' +
      ' Phone:\n' +
      ' Address:\n' +
      ' Product you want:\n' +
      ' Notes:\n' +
      '══════════════════════',

    missingFields:
      ' It looks like some fields are missing. Please fill again \n\n' +
      '══════════════════════\n' +
      ' Name:\n' +
      ' Phone:\n' +
      ' Address:\n' +
      ' Product you want:\n' +
      ' Notes:\n' +
      '══════════════════════',

    invalidYesNo:
      ' Please reply with 1 or 2 only ',

    restart:
      ' Ok! Let\'s start again ',

    cancelMsg:
      'Your order has been cancelled. Have a great day! 👋',

    summaryHeader: ' Your order summary:\n',
    summaryOrder: (i) => `──── Order #${i + 1} ────\n`,
    summaryName: ' Name',
    summaryPhone: ' Phone',
    summaryAddress: ' Address',
    summaryProduct: ' Product',
    summaryNotes: ' Notes',
    summaryReceived: ' Received',

    errorMsg:
      ' Sorry, an error occurred. Please try again.',
  },
};

// ─── LANGUAGE SELECTION MENU (shown to EVERY new user) ────────────────────────
const LANG_SELECT_MSG =
  'Please select your language\n\n' +
  'کوردی\n' +
  'عربي\n' +
  'English\n' +
  '1 / 2 / 3';

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

async function handleNewMessage(senderId, messageText, messageId) {
  if (!messageText || !messageText.trim()) return;

  let convo = await sessionStore.get(senderId);
  if (!convo) {
    convo = {
      state: 'lang',   // ← ALWAYS starts at lang selection
      lang: null,
      orders: [],
      messageIds: new Set(),
    };
    await sessionStore.set(senderId, convo);
    console.log(`💬 New session started: ${senderId}`);
  }

  if (convo.messageIds.has(messageId)) return;
  convo.messageIds.add(messageId);

  if (convo.messageIds.size > 50) {
    const first = convo.messageIds.values().next().value;
    convo.messageIds.delete(first);
  }

  const text = messageText.trim();
  console.log(`👤 [${senderId}] state=${convo.state} lang=${convo.lang} msg="${text}"`);

  // ── HUMAN MODE — complete silence ──────────────────────────────────────────
  if (convo.state === 'human') {
    await sessionStore.set(senderId, convo); // save messageId
    console.log(`🔕 [${senderId}] in human mode — bot silent`);
    return;
  }

  // ── RESTART KEYWORD — goes back to language selection ───────────────────────
  if (isRestart(text)) {
    convo.state = 'lang';
    convo.lang  = null;
    convo.orders = [];
    console.log(`🔄 [${senderId}] restarted`);
    await sessionStore.set(senderId, convo);
    await typingDelay(LANG_SELECT_MSG);
    await sendInstagramReply(senderId, LANG_SELECT_MSG);
    return;
  }

  // ── CANCEL KEYWORD — clears the session entirely ────────────────────────────
  if (isCancel(text)) {
    const L = convo.lang ? getLangPack(convo) : LANG.ku;
    const cancelText = L.cancelMsg;
    await sessionStore.delete(senderId);
    console.log(`❌ [${senderId}] cancelled their order`);
    await typingDelay(cancelText);
    await sendInstagramReply(senderId, cancelText);
    return;
  }

  // ── STATE: finished ─────────────────────────────────────────────────────────
  if (convo.state === 'finished') {
    const t = text.trim();
    if (t === '1' || t === '١' || isRestart(t)) {
      convo.state = 'menu';
      convo.orders = [];
      console.log(`🔄 [${senderId}] restarted from finished`);
      await sessionStore.set(senderId, convo);
      const L = getLangPack(convo);
      await typingDelay(L.welcome);
      await sendInstagramReply(senderId, L.welcome);
    } else {
      console.log(`🔕 [${senderId}] finished mode — bot silent for "${text}"`);
      await sessionStore.set(senderId, convo); // just save messageId
    }
    return;
  }

  // ── STATE: lang ──────────────────────────────────────────────────────────────
  if (convo.state === 'lang') {
    const chosen = getLangChoice(text);

    if (chosen) {
      convo.lang  = chosen;
      convo.state = 'menu';
      const L = getLangPack(convo);
      console.log(`🌍 [${senderId}] selected lang: ${chosen}`);
      await sessionStore.set(senderId, convo);
      await typingDelay(L.langSelected);
      await sendInstagramReply(senderId, L.langSelected + '\n\n' + L.welcome);
    } else {
      // Any message that is not 1/2/3 → show language menu
      console.log(`🌍 [${senderId}] showing language menu`);
      await sessionStore.set(senderId, convo);
      await typingDelay(LANG_SELECT_MSG);
      await sendInstagramReply(senderId, LANG_SELECT_MSG);
    }
    return;
  }

  const L = getLangPack(convo);

  // ── STATE: menu ─────────────────────────────────────────────────────────────
  if (convo.state === 'menu') {
    const choice = getMenuChoice(text);

    if (choice === '1') {
      convo.state = 'ordering';
      console.log(`🛒 [${senderId}] chose Order`);
      await sessionStore.set(senderId, convo);
      await typingDelay(L.orderForm);
      await sendInstagramReply(senderId, L.orderForm);

    } else if (choice === '2') {
      convo.state = 'human';
      console.log(`💬 [${senderId}] chose Human mode`);
      await sessionStore.set(senderId, convo);
      await typingDelay(L.humanMode);
      await sendInstagramReply(senderId, L.humanMode);

    } else {
      console.log(`📋 [${senderId}] showing main menu`);
      await sessionStore.set(senderId, convo);
      await typingDelay(L.welcome);
      await sendInstagramReply(senderId, L.welcome);
    }
    return;
  }

  // ── STATE: ordering ─────────────────────────────────────────────────────────
  if (convo.state === 'ordering') {
    const parsed = parseFilledForm(text);

    if (!parsed) {
      const hasAnyContent = text.length > 20;
      const reply = hasAnyContent ? L.missingFields : L.invalidForm;
      console.log(`⚠️ [${senderId}] form invalid`);
      await sessionStore.set(senderId, convo);
      await typingDelay(reply);
      await sendInstagramReply(senderId, reply);
      return;
    }

    // ── DUPLICATE GUARD ──
    const isDuplicate = await sessionStore.hasOrderedRecently(parsed.phone);
    if (isDuplicate) {
      console.log(`⚠️ [${senderId}] duplicate phone blocked: ${parsed.phone}`);
      const duplicateMsg = 
        convo.lang === 'ku' ? 'ببورە، ئەڤ ژمارەیە پێشتر داخازیەک کریە. چاڤەڕێ بکە تا پەیوەندیێ بتەکەین.' :
        convo.lang === 'ar' ? 'عذراً، هذا الرقم قام بطلب مسبقاً. يرجى الانتظار حتى نتواصل معك.' :
        'Sorry, an order has already been placed with this phone number recently. Please wait for our team to contact you.';
      
      await sessionStore.set(senderId, convo);
      await typingDelay(duplicateMsg);
      await sendInstagramReply(senderId, duplicateMsg);
      return;
    }

    convo.orders.push({
      name:    parsed.name,
      phone:   parsed.phone,
      address: parsed.address,
      product: parsed.product,
      notes:   parsed.notes || '—',
    });

    console.log(`✅ [${senderId}] order #${convo.orders.length} collected`);
    convo.state = 'confirm';
    await sessionStore.set(senderId, convo);
    await typingDelay(L.anotherOrder);
    await sendInstagramReply(senderId, L.anotherOrder);
    return;
  }

  // ── STATE: confirm ───────────────────────────────────────────────────────────
  if (convo.state === 'confirm') {
    if (isYes(text)) {
      convo.state = 'ordering';
      console.log(`➕ [${senderId}] wants another order`);
      await sessionStore.set(senderId, convo);
      await typingDelay(L.orderForm);
      await sendInstagramReply(senderId, L.orderForm);

    } else if (isNo(text)) {
      console.log(`🏁 [${senderId}] done — saving ${convo.orders.length} order(s)`);
      // We do not save state here, finalizeAllOrders handles cleanup
      await finalizeAllOrders(senderId, convo, L);

    } else {
      console.log(`⚠️ [${senderId}] invalid yes/no`);
      await sessionStore.set(senderId, convo);
      await typingDelay(L.invalidYesNo);
      await sendInstagramReply(senderId, L.invalidYesNo);
    }
    return;
  }
}

// ─── FINALIZE ALL ORDERS ──────────────────────────────────────────────────────

async function finalizeAllOrders(senderId, convo, L) {
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

      const orderNumber = await appendOrder(sheetOrder);
      if (i === 0) firstOrderNumber = orderNumber;
      
      // Record phone number in duplicate guard
      await sessionStore.recordPhone(order.phone);
      
      console.log(`💾 [${senderId}] order #${i + 1} saved as row #${orderNumber}`);
    }

    // Telegram notification
    const telegramMsg = buildTelegramNotification(senderId, convo.orders, firstOrderNumber, convo.lang);
    const { sendTelegram } = require('./telegramService');
    await sendTelegram(telegramMsg);

    // Summary to customer
    const summary = buildSummary(convo.orders, L);
    await typingDelay(summary);
    await sendInstagramReply(senderId, summary);

    await new Promise(resolve => setTimeout(resolve, 800));
    await sendInstagramReply(senderId, L.thankYou);

    console.log(`✅ [${senderId}] all ${convo.orders.length} order(s) finalized`);

  } catch (err) {
    console.error(`❌ [${senderId}] failed:`, err.message);
    await sendInstagramReply(senderId, L.errorMsg);
  } finally {
    // Instead of deleting, set state to finished so bot stays silent
    convo.state = 'finished';
    convo.orders = [];
    await sessionStore.set(senderId, convo);
    console.log(`🏁 [${senderId}] session moved to finished state (waiting for 1)`);
  }
}

module.exports = { handleNewMessage };
