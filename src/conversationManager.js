/**
 * conversationManager.js
 *
 * Pure Regex State Machine — No AI required.
 * Handles the full order flow for Instagram DMs.
 *
 * STATES:
 *   menu       → Show welcome menu, wait for 1 or 2
 *   ordering   → Send form, wait for filled form
 *   confirm    → Ask if user wants another order (yes/no)
 *   human      → Bot is completely silent, owner handles manually
 *   done       → Order finalized, conversation cleared
 */

const { appendOrder } = require('./sheetsService');
// telegramService loaded dynamically in finalizeAllOrders
const { sendInstagramReply } = require('./instagramReplyService');

// ─── ALL BOT MESSAGES (Kurdish + Arabic + English) ────────────────────────────
const MSG = {

  // Welcome menu
  welcome:
    'بخێرهاتی دێ چاوا شێم هاریکاریا تەکەم ؟ 👋\n' +
    'مرحباً! كيف نقدر نساعدك؟\n' +
    'Hello! How can we help you?\n\n' +
    '─────────────────────\n' +
    '1️⃣  من دڤێت داخازیەکێ بکەم\n' +
    '     أريد أطلب منتج  /  I want to order\n\n' +
    '2️⃣  من دڤێت پەیوەندیێ بوە بکەم\n' +
    '     أريد أتواصل  /  I want to contact\n' +
    '─────────────────────\n' +
    'کەرەمکە ١ یان ٢ بنڤیسە 👇\n' +
    'اختر 1 أو 2  /  Reply with 1 or 2',

  // Option 1 — send the order form
  orderForm:
    'گەلەک باشە ئەڤێ فورمێ پر بکە و بۆمە ڤرێکە ڤە وەک نامە 👇\n' +
    'ممتاز! أرسل لنا هذا النموذج  /  Great! Fill this form:\n\n' +
    '──────────────────────\n' +
    'ناڤ / الاسم / Name:\n' +
    'ژمارا موبایلێ / رقم الهاتف / Phone:\n' +
    'ناڤونیشان / العنوان / Address:\n' +
    'تە چ جورە بەرهەم دڤێت / المنتج / Product:\n' +
    'تێبینی / ملاحظات / Notes:\n' +
    '──────────────────────',

  // Ask if they want another order
  anotherOrder:
    'داخازیا تە نوکە لدەف مەیە ✅\n' +
    'تە دڤێت داخازیەکا دیژی بکەی ?\n\n' +
    'تم استلام طلبك ✅ هل تريد إضافة طلب آخر؟\n' +
    'Order received ✅ Want to add another order?\n\n' +
    'بەلی ✅  /  نعم  /  Yes\n' +
    'نەخێر ❌  /  لا  /  No',

  // Final thank you — all orders saved
  thankYou:
    'سوپاس بوتە داخازیاتە هاتە وەرگرتن سەرکەفتیانە 🎉\n' +
    'لنێزیک دێ پەیوەندیێ بتەکەین\n\n' +
    'شكراً! تم استلام طلباتك بنجاح 🎉\n' +
    'سنتواصل معك قريباً\n\n' +
    'Thank you! All your orders received 🎉\n' +
    'We will contact you soon!',

  // Option 2 — go silent
  humanMode:
    'بێ گومان تۆ دشێی نامێن خو ڤرێکەی و تیما مە دێ بەرسڤدەت 😊\n\n' +
    'بالتأكيد! تفضل راسل الصفحة بشكل طبيعي 😊\n' +
    'سيرد عليك أحد من فريقنا قريباً\n\n' +
    'Of course! Feel free to message the page normally 😊\n' +
    'Our team will reply to you shortly.',

  // Invalid choice (not 1 or 2)
  invalidChoice:
    'یان ١ بهەلبژێرە یان ٢ 😊\n' +
    'اختر 1 أو 2 فقط  /  Please reply with 1 or 2 only 😊',

  // Form not filled correctly
  invalidForm:
    'فورمێ بدروستی پر بکە و دوبارە بهنێرە 👇\n' +
    'الرجاء ملء جميع الحقول بشكل صحيح وإعادة الإرسال 👇\n' +
    'Please fill all fields correctly and send again 👇\n\n' +
    '──────────────────────\n' +
    'ناڤ / الاسم / Name:\n' +
    'ژمارا موبایلێ / رقم الهاتف / Phone:\n' +
    'ناڤونیشان / العنوان / Address:\n' +
    'تە چ جورە بەرهەم دڤێت / المنتج / Product:\n' +
    'تێبینی / ملاحظات / Notes:\n' +
    '──────────────────────',

  // Missing some fields
  missingFields:
    'وەکی یا دیار تە هندەک بەش یێ ژبیرکری دوبارە پربکە 👇\n' +
    'يبدو أنك نسيت بعض الحقول، أعد التعبئة 👇\n' +
    'It seems you missed some fields. Please fill again 👇\n\n' +
    '──────────────────────\n' +
    'ناڤ / الاسم / Name:\n' +
    'ژمارا موبایلێ / رقم الهاتف / Phone:\n' +
    'ناڤونیشان / العنوان / Address:\n' +
    'تە چ جورە بەرهەم دڤێت / المنتج / Product:\n' +
    'تێبینی / ملاحظات / Notes:\n' +
    '──────────────────────',

  // Invalid yes/no answer
  invalidYesNo:
    'بەرسڤ ب بەلی یان نەخێر بدە 😊\n' +
    'الرجاء الرد بـ نعم أو لا فقط  /  Please reply Yes or No only 😊',

  // Restart keyword response
  restart:
    'ببورە دا دوبارە دەستپێبکەین 😊\n' +
    'حسناً! لنبدأ من جديد  /  Let\'s start again 😊',

  // Order summary (sent to customer before saving)
  summaryHeader:
    'ئەڤە کورتیا داخازیا تەیە:\n' +
    'ملخص طلبك:  /  Your order summary:\n',
};

// ─── CONVERSATIONS STORE ──────────────────────────────────────────────────────
// Structure per user:
// {
//   state: 'menu' | 'ordering' | 'confirm' | 'human' | 'done'
//   orders: [ { name, phone, address, product, notes } ]
//   messageIds: Set
// }
const conversations = new Map();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Small human-like typing delay
 * Longer messages = slightly longer delay
 */
function typingDelay(text) {
  const base = 800;
  const extra = Math.min(text.length * 5, 1200);
  return new Promise(resolve => setTimeout(resolve, base + extra));
}

/**
 * Detect if user said YES in Kurdish, Arabic, or English
 */
function isYes(text) {
  const t = text.trim().toLowerCase();
  return ['بەلی', 'بەلێ', 'بلی', 'بله', 'بلا', 'نعم', 'اه', 'آه', 'اي',
    'yes', 'yeah', 'yep', 'y', 'ok', 'okay', 'باشە', 'ئوکەی', 'هاوار',
    '✅', 'bale', 'erê', 'ere'].includes(t);
}

/**
 * Detect if user said NO in Kurdish, Arabic, or English
 */
function isNo(text) {
  const t = text.trim().toLowerCase();
  return ['نەخێر', 'نه', 'لا', 'no', 'nope', 'n', 'نا', 'خێر',
    '❌', 'na', 'nê', 'ne'].includes(t);
}

/**
 * Detect if user wants to restart
 */
function isRestart(text) {
  const t = text.trim().toLowerCase();
  return ['دەستپیک', 'menu', 'restart', 'start', 'ابدأ', 'رجوع',
    'back', 'باك', 'قائمة', 'قايمة'].includes(t);
}

/**
 * Detect if user chose option 1 or 2 from the menu
 * Accepts: 1, ١, "option 1", "1️⃣" etc.
 */
function getMenuChoice(text) {
  const t = text.trim();
  // Check for 1
  if (['1', '١', '1️⃣', 'one', '١️⃣'].includes(t)) return '1';
  if (t.startsWith('1') || t.startsWith('١')) return '1';
  // Check for 2
  if (['2', '٢', '2️⃣', 'two', '٢️⃣'].includes(t)) return '2';
  if (t.startsWith('2') || t.startsWith('٢')) return '2';
  return null;
}

/**
 * Parse a filled order form from the customer's message.
 * Tries to extract Name, Phone, Address, Product, Notes.
 * Works for Kurdish, Arabic, and English labels.
 *
 * Returns: { name, phone, address, product, notes } or null if too many fields missing
 */
function parseFilledForm(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // All possible label variants per field
  const labels = {
    name:    ['ناڤ', 'ناو', 'الاسم', 'اسم', 'name', 'ناڤ /', 'ناو:'],
    phone:   ['ژمارا موبایلێ', 'ژمارا', 'موبایل', 'رقم الهاتف', 'هاتف', 'phone', 'mobile', 'tel', 'ژمارا موبایلێ /'],
    address: ['ناڤونیشان', 'ناونیشان', 'العنوان', 'عنوان', 'address', 'ناڤونیشان /'],
    product: ['تە چ جورە بەرهەم دڤێت', 'بەرهەم', 'المنتج', 'منتج', 'product', 'تە چ جورە بەرهەم دڤێت /'],
    notes:   ['تێبینی', 'تیبینی', 'ملاحظات', 'ملاحظه', 'notes', 'note', 'تێبینی /'],
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

  // If labels not found, try positional parsing (user sent values only, line by line)
  const hasAnyLabel = Object.values(result).some(v => v.length > 0);
  if (!hasAnyLabel && lines.length >= 4) {
    result.name    = lines[0] || '';
    result.phone   = lines[1] || '';
    result.address = lines[2] || '';
    result.product = lines[3] || '';
    result.notes   = lines[4] || '';
  }

  // Validate — we need at least name + phone + product
  const valid = result.name.length > 0 && result.phone.length > 0 && result.product.length > 0;
  return valid ? result : null;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build order summary message to show the customer
 */
function buildSummary(ordersList) {
  let summary = MSG.summaryHeader + '\n';
  ordersList.forEach((order, i) => {
    summary += `──── ژمارا داخازیاتە / Order #${i + 1} ────\n`;
    summary += `👤 ناڤ / Name: ${order.name}\n`;
    summary += `📱 موبایل / Phone: ${order.phone}\n`;
    summary += `📍 ناڤونیشان / Address: ${order.address}\n`;
    summary += `📦 بەرهەم / Product: ${order.product}\n`;
    if (order.notes && order.notes !== '—') {
      summary += `📝 تێبینی / Notes: ${order.notes}\n`;
    }
    summary += '\n';
  });
  summary += 'هاتە وەرگرتن ✅\n';
  summary += 'تم الاستلام ✅  /  Received ✅';
  return summary;
}

/**
 * Build Telegram notification for ALL orders at once
 */
function buildTelegramNotification(senderId, ordersList, orderStartNumber) {
  const now = new Date();
  const date = now.toLocaleDateString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

  let msg = `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🛒 <b>NEW ORDER SESSION</b>\n`;
  msg += `🔗 <b>IG User:</b> user_${senderId}\n`;
  msg += `📅 <b>Date:</b> ${date} - ${time}\n`;
  msg += `📦 <b>Total Orders:</b> ${ordersList.length}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  ordersList.forEach((order, i) => {
    msg += `───── Order #${orderStartNumber + i} ─────\n`;
    msg += `👤 <b>Name:</b> ${order.name || '⚠️ MISSING'}\n`;
    msg += `📱 <b>Phone:</b> ${order.phone || '⚠️ MISSING'}\n`;
    msg += `📍 <b>Address:</b> ${order.address || '⚠️ MISSING'}\n`;
    msg += `📦 <b>Product:</b> ${order.product || '⚠️ MISSING'}\n`;
    msg += `📝 <b>Notes:</b> ${order.notes || '—'}\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━━`;
  return msg;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

async function handleNewMessage(senderId, messageText, messageId) {
  if (!messageText || !messageText.trim()) return;

  // Get or create conversation
  let convo = conversations.get(senderId);
  if (!convo) {
    convo = {
      state: 'menu',
      orders: [],
      messageIds: new Set(),
    };
    conversations.set(senderId, convo);
    console.log(`💬 New session started: ${senderId}`);
  }

  // Deduplicate messages
  if (convo.messageIds.has(messageId)) return;
  convo.messageIds.add(messageId);

  // Cleanup messageIds to prevent memory leak (keep last 50)
  if (convo.messageIds.size > 50) {
    const first = convo.messageIds.values().next().value;
    convo.messageIds.delete(first);
  }

  const text = messageText.trim();
  console.log(`👤 [${senderId}] state=${convo.state} msg="${text}"`);

  // ── HUMAN MODE — complete silence ──────────────────────────────────────────
  if (convo.state === 'human') {
    console.log(`🔕 [${senderId}] is in human mode — bot is silent`);
    return;
  }

  // ── RESTART KEYWORD — works from any state ──────────────────────────────────
  if (isRestart(text)) {
    convo.state = 'menu';
    convo.orders = [];
    console.log(`🔄 [${senderId}] restarted conversation`);
    await typingDelay(MSG.restart);
    await sendInstagramReply(senderId, MSG.restart + '\n\n' + MSG.welcome);
    return;
  }

  // ── STATE: menu ─────────────────────────────────────────────────────────────
  if (convo.state === 'menu') {
    const choice = getMenuChoice(text);

    if (choice === '1') {
      // Option 1 — start ordering
      convo.state = 'ordering';
      console.log(`🛒 [${senderId}] chose Option 1 — ordering`);
      await typingDelay(MSG.orderForm);
      await sendInstagramReply(senderId, MSG.orderForm);

    } else if (choice === '2') {
      // Option 2 — go silent, human takes over
      convo.state = 'human';
      console.log(`💬 [${senderId}] chose Option 2 — human mode`);
      await typingDelay(MSG.humanMode);
      await sendInstagramReply(senderId, MSG.humanMode);

    } else {
      // Any other message on first contact → show welcome menu
      // (covers "hi", "hello", "سلاڤ", anything)
      console.log(`📋 [${senderId}] showing welcome menu`);
      await typingDelay(MSG.welcome);
      await sendInstagramReply(senderId, MSG.welcome);
    }
    return;
  }

  // ── STATE: ordering ─────────────────────────────────────────────────────────
  if (convo.state === 'ordering') {
    const parsed = parseFilledForm(text);

    if (!parsed) {
      // Form couldn't be parsed — check if they're missing fields
      const hasAnyContent = text.length > 20; // They sent something but not a proper form
      const reply = hasAnyContent ? MSG.missingFields : MSG.invalidForm;
      console.log(`⚠️ [${senderId}] form invalid — asking again`);
      await typingDelay(reply);
      await sendInstagramReply(senderId, reply);
      return;
    }

    // Form parsed successfully — save this order
    convo.orders.push({
      name:    parsed.name,
      phone:   parsed.phone,
      address: parsed.address,
      product: parsed.product,
      notes:   parsed.notes || '—',
    });

    console.log(`✅ [${senderId}] order #${convo.orders.length} collected`);

    // Ask if they want another order
    convo.state = 'confirm';
    await typingDelay(MSG.anotherOrder);
    await sendInstagramReply(senderId, MSG.anotherOrder);
    return;
  }

  // ── STATE: confirm ───────────────────────────────────────────────────────────
  if (convo.state === 'confirm') {

    if (isYes(text)) {
      // They want another order — go back to ordering state
      convo.state = 'ordering';
      console.log(`➕ [${senderId}] wants another order (#${convo.orders.length + 1})`);
      await typingDelay(MSG.orderForm);
      await sendInstagramReply(senderId, MSG.orderForm);

    } else if (isNo(text)) {
      // They're done — finalize all orders
      console.log(`🏁 [${senderId}] finished — saving ${convo.orders.length} order(s)`);
      await finalizeAllOrders(senderId, convo);

    } else {
      // Invalid response
      console.log(`⚠️ [${senderId}] invalid yes/no response`);
      await typingDelay(MSG.invalidYesNo);
      await sendInstagramReply(senderId, MSG.invalidYesNo);
    }
    return;
  }
}

// ─── FINALIZE ALL ORDERS ──────────────────────────────────────────────────────

async function finalizeAllOrders(senderId, convo) {
  const now = new Date();
  const date = now.toLocaleDateString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

  let firstOrderNumber = null;

  try {
    // Save each order as a separate row in Google Sheets
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
        rawMessage: `ناڤ: ${order.name}\nموبایل: ${order.phone}\nناڤونیشان: ${order.address}\nبەرهەم: ${order.product}\nتێبینی: ${order.notes}`,
        source: 'DM',
        date,
        time,
        status: '🟡 جديد',
      };

      const orderNumber = await appendOrder(sheetOrder);
      if (i === 0) firstOrderNumber = orderNumber;
      console.log(`💾 [${senderId}] order #${i + 1} saved as row #${orderNumber}`);
    }

    // Send ONE combined Telegram notification for all orders
    const telegramMsg = buildTelegramNotification(senderId, convo.orders, firstOrderNumber);
    const { sendTelegram } = require('./telegramService');
    await sendTelegram(telegramMsg);

    // Send summary to customer
    const summary = buildSummary(convo.orders);
    await typingDelay(summary);
    await sendInstagramReply(senderId, summary);

    // Then send thank you
    await new Promise(resolve => setTimeout(resolve, 800));
    await sendInstagramReply(senderId, MSG.thankYou);

    console.log(`✅ [${senderId}] all ${convo.orders.length} order(s) finalized`);

  } catch (err) {
    console.error(`❌ [${senderId}] failed to finalize orders:`, err.message);
    // Don't leave user hanging
    await sendInstagramReply(senderId,
      'ببورە، هەڵەیەک ڕووی داد. دوبارە هەوڵبدە.\n' +
      'عذراً، حدث خطأ. حاول مرة أخرى.\n' +
      'Sorry, an error occurred. Please try again.'
    );
  } finally {
    // Always clean up conversation from memory
    conversations.delete(senderId);
    console.log(`🗑️ [${senderId}] conversation cleared from memory`);
  }
}

module.exports = { handleNewMessage };
