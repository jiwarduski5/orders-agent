require('dotenv').config();

const replyService = require('./instagramReplyService');
replyService.sendInstagramReply = async (senderId, text) => {
  console.log(`\n  BOT says:\n  ${text}\n${'  ' + '-'.repeat(40)}`);
};

const sheetsService = require('./sheetsService');
sheetsService.appendOrder = async (order) => {
  console.log(`  Saved: ${order.customerName} | ${order.product}`);
  return Math.floor(Math.random() * 1000);
};

const telegramService = require('./telegramService');
telegramService.sendTelegram = async (msg) => {
  console.log(`  Telegram sent`);
};

const { handleNewMessage } = require('./conversationManager');

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function simulate(sender, steps) {
  let id = 1;
  for (const msg of steps) {
    console.log(`\n  "${msg}"`);
    await handleNewMessage(sender, msg, `${sender}_${id++}`);
    await delay(300);
  }
}

async function runTest() {
  console.log('\n  ============================');
  console.log('     LANGUAGE SELECTION TEST');
  console.log('  ============================\n');

  console.log('  TEST 1: Kurdish User');
  await simulate('user_KU', [
    'Hello',
    '1',
    '1',
    'Name: Jiwar\nPhone: 07501234567\nAddress: Duhok\nProduct you want: Nike Shoes\nNotes: Fast',
    '2',
  ]);

  await delay(500);

  console.log('\n  TEST 2: Arabic User');
  await simulate('user_AR', [
    'مرحبا',
    '2',
    '1',
    'الاسم: Ahmed\nرقم الهاتف: 07701234567\nالعنوان: Baghdad\nالمنتج المطلوب: iPhone 15\nملاحظات: none',
    '2',
  ]);

  await delay(500);

  console.log('\n  TEST 3: English User');
  await simulate('user_EN', [
    'hello',
    '3',
    '1',
    'Name: Sara\nPhone: 07601234567\nAddress: Erbil\nProduct you want: Adidas T-shirt\nNotes: Size L',
    'no',
  ]);

  console.log('\n  ============================');
  console.log('     ALL DONE!');
  console.log('  ============================\n');
}

runTest();
