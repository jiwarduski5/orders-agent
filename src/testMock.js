require('dotenv').config();
const { handleNewMessage } = require('./conversationManager');

// Mock instagramReplyService to just console.log the bot's reply
jest = {
  mock: function() {}
};

// We will replace sendInstagramReply dynamically
const replyService = require('./instagramReplyService');
replyService.sendInstagramReply = async (senderId, text) => {
  console.log(`\n🤖 BOT SAYS:\n${text}\n`);
};

// Mock sheet and telegram to avoid API calls during test
const sheetsService = require('./sheetsService');
sheetsService.appendOrder = async (order) => {
  console.log(`\n📋 MOCK SHEET SAVED: ${order.customerName} - ${order.product}\n`);
  return Math.floor(Math.random() * 1000);
};

const telegramService = require('./telegramService');
telegramService.sendTelegram = async (msg) => {
  console.log(`\n🚀 MOCK TELEGRAM SENT:\n${msg}\n`);
};

async function runTest() {
  const sender = "testUser123";
  let msgId = 1;

  console.log("=== STARTING MOCK TEST ===");

  // 1. User says hi
  console.log("👤 USER: hi");
  await handleNewMessage(sender, "hi", msgId++);
  await new Promise(r => setTimeout(r, 500));

  // 2. User chooses 1
  console.log("👤 USER: 1");
  await handleNewMessage(sender, "1", msgId++);
  await new Promise(r => setTimeout(r, 500));

  // 3. User sends an incomplete form
  console.log("👤 USER: just some random text");
  await handleNewMessage(sender, "just some random text", msgId++);
  await new Promise(r => setTimeout(r, 500));

  // 4. User sends a filled form
  const goodForm = `
ناڤ: Jiwar
موبایل: 07501234567
ناڤونیشان: Duhok
بەرهەم: iPhone 15
تێبینی: Fast delivery
  `;
  console.log("👤 USER sends valid form...");
  await handleNewMessage(sender, goodForm, msgId++);
  await new Promise(r => setTimeout(r, 500));

  // 5. User says no to another order
  console.log("👤 USER: no");
  await handleNewMessage(sender, "no", msgId++);

  console.log("=== TEST FINISHED ===");
}

runTest();
