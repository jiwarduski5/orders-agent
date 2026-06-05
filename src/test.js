/**
 * test.js
 *
 * Local testing script to verify the order parsing system.
 * Run this with: node src/test.js
 *
 * It will send test messages to BOTH the AI Brain (if API key is set)
 * and the Regex Fallback Brain, so you can see the difference!
 */

require('dotenv').config();
const { parseWithAI } = require('./aiParser');
const { parseOrder } = require('./orderParser');

const MESSAGES = [
  // Test 1: Messy Badini / Sorani mix with no explicit labels
  `سلاڤ
Jiwar sidqe sadeeq
دهۆک تاخێ ماسیکێ
07501234567
کراس (zara)
شین XL
دانە 2`,

  // Test 2: Arabic with standard labels
  `السلام عليكم
الاسم: أحمد محمد
العنوان: بغداد الكرادة
رقمي: 07709998887
اريد قميص رجالي
اللون ماروني
المقاس وسط
حبة واحدة`,

  // Test 3: Missing info
  `hello
i want to order
black t-shirt size M
thanks`
];

async function runTests() {
  console.log('🧪 Starting Order Parser Tests...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (let i = 0; i < MESSAGES.length; i++) {
    const msg = MESSAGES[i];
    console.log(`\n📨 TEST MESSAGE #${i + 1}:\n"${msg}"\n`);

    // 1. Test Regex Fallback Brain
    console.log('🔧 Running REGEX FALLBACK Brain...');
    const regexResult = parseOrder(msg, 'test_user_regex', 'TEST');
    console.log(regexResult);
    
    // 2. Test AI Primary Brain (if key exists)
    if (process.env.GEMINI_API_KEY) {
      console.log('\n🤖 Running AI PRIMARY Brain...');
      const aiResult = await parseWithAI(msg);
      console.log(aiResult || '⚠️ AI returned null (Check API key or limits)');
    } else {
      console.log('\n🤖 Skipping AI Test (GEMINI_API_KEY is not set in .env)');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  console.log('\n✅ Tests complete!');
}

runTests();
