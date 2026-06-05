require('dotenv').config();
const { getAIResponse } = require('./aiParser');

async function runTest() {
  console.log("🧪 Testing Native AI Chatbot Flow...");
  
  // Simulated conversation
  const history = [
    { role: 'user', content: 'سلاڤ' }
  ];

  console.log(`\n👤 User: ${history[history.length - 1].content}`);
  let response = await getAIResponse(history);
  console.log(`🤖 AI: ${response.replyToCustomer}`);
  console.log(`[isOrderComplete: ${response.isOrderComplete}]`);
  
  history.push({ role: 'assistant', content: response.replyToCustomer });
  history.push({ role: 'user', content: 'ئەز کراسەکێ شین دڤێم بۆ من' });
  
  console.log(`\n👤 User: ${history[history.length - 1].content}`);
  response = await getAIResponse(history);
  console.log(`🤖 AI: ${response.replyToCustomer}`);
  console.log(`[isOrderComplete: ${response.isOrderComplete}]`);

  history.push({ role: 'assistant', content: response.replyToCustomer });
  history.push({ role: 'user', content: 'ناڤێ من جیوارە، ژ دهۆک تاخێ ماسیکێ مە، ژمارا من 07501234567 سایزێ من XL' });

  console.log(`\n👤 User: ${history[history.length - 1].content}`);
  response = await getAIResponse(history);
  console.log(`🤖 AI: ${response.replyToCustomer}`);
  console.log(`[isOrderComplete: ${response.isOrderComplete}]`);
  console.log('\n✅ Extracted Data:', response.extractedData);
}

runTest();
