require('dotenv').config();
const { getAIResponse } = require('./aiParser');

async function runTest() {
  console.log("🧪 Testing Two-Phase Registration Flow...\n");
  
  const history = [];

  // 1. User says hi
  console.log("═══ TEST 1: Greeting ═══");
  history.push({ role: 'user', content: 'سلاڤ' });
  console.log('👤 User: سلاڤ');
  let r = await getAIResponse(history);
  console.log(`🤖 AI: ${r.replyToCustomer}\n`);
  history.push({ role: 'assistant', content: r.replyToCustomer });

  // 2. User chats generally
  console.log("═══ TEST 2: General Chat ═══");
  history.push({ role: 'user', content: 'ez dvet orderek bkem' });
  console.log('👤 User: ez dvet orderek bkem');
  r = await getAIResponse(history);
  console.log(`🤖 AI: ${r.replyToCustomer}\n`);
  history.push({ role: 'assistant', content: r.replyToCustomer });

  // 3. User agrees to register
  console.log("═══ TEST 3: User says Yes ═══");
  history.push({ role: 'user', content: 'bale' });
  console.log('👤 User: bale');
  r = await getAIResponse(history);
  console.log(`🤖 AI: ${r.replyToCustomer}\n`);
  history.push({ role: 'assistant', content: r.replyToCustomer });

  // 4. User gives product
  console.log("═══ TEST 4: User gives product ═══");
  history.push({ role: 'user', content: 'nike shoes' });
  console.log('👤 User: nike shoes');
  r = await getAIResponse(history);
  console.log(`🤖 AI: ${r.replyToCustomer}`);
  console.log(`[Extracted Product: "${r.extractedData.product}"]\n`);
  history.push({ role: 'assistant', content: r.replyToCustomer });
}

runTest().catch(console.error);
