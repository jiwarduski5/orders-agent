require('dotenv').config();

// Mock Instagram reply
const replyService = require('./instagramReplyService');
replyService.sendInstagramReply = async (senderId, text) => {
  console.log(`\n🤖 BOT [${senderId}]:\n${text}\n${'─'.repeat(40)}`);
};

// Mock Sheets
const sheetsService = require('./sheetsService');
sheetsService.appendOrder = async (order) => {
  console.log(`\n📊 SHEET: ${order.customerName} | ${order.product}\n`);
  return Math.floor(Math.random() * 1000);
};

// Mock Telegram
const telegramService = require('./telegramService');
telegramService.sendTelegram = async (msg) => {
  console.log(`\n🚀 TELEGRAM SENT ✅\n`);
};

const { handleNewMessage } = require('./conversationManager');

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function simulate(sender, steps) {
  let id = 1;
  for (const msg of steps) {
    console.log(`\n👤 USER [${sender}]: "${msg}"`);
    await handleNewMessage(sender, msg, `${sender}_${id++}`);
    await delay(300);
  }
}

async function runTest() {
  console.log('\n🧪 ═══════════════════════════════════');
  console.log('   LANGUAGE SELECTION TEST');
  console.log('═══════════════════════════════════\n');

  // TEST 1: Kurdish user
  console.log('\n🇮🇶 ── TEST 1: Kurdish User ──');
  await simulate('user_KU', [
    'سلاڤ',       // first message → shows lang menu
    '1',          // picks Badini Kurdish
    '1',          // picks Order
    '👤 ناڤ: Jiwar\n📱 ژمارا موبایلێ: 07501234567\n📍 ناڤونیشان: Duhok\n📦 بەرهەمێ دڤێت: Nike Shoes\n📝 تێبینی: Fast',
    'نەخێر',       // no more orders
  ]);

  await delay(500);

  // TEST 2: Arabic user
  console.log('\n🇸🇦 ── TEST 2: Arabic User ──');
  await simulate('user_AR', [
    'مرحبا',      // first message → shows lang menu
    '2',          // picks Arabic
    '1',          // picks Order
    '👤 الاسم: Ahmed\n📱 رقم الهاتف: 07701234567\n📍 العنوان: Baghdad\n📦 المنتج المطلوب: iPhone 15\n📝 ملاحظات: none',
    'لا',         // no more orders
  ]);

  await delay(500);

  // TEST 3: English user
  console.log('\n🇬🇧 ── TEST 3: English User ──');
  await simulate('user_EN', [
    'hello',      // first message → shows lang menu
    '3',          // picks English
    '1',          // picks Order
    '👤 Name: Sara\n📱 Phone: 07601234567\n📍 Address: Erbil\n📦 Product you want: Adidas T-shirt\n📝 Notes: Size L',
    'no',         // no more orders
  ]);

  console.log('\n✅ ═══════════════════════════════════');
  console.log('   ALL TESTS DONE!');
  console.log('═══════════════════════════════════\n');
}

runTest();
