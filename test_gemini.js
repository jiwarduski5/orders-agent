const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  try {
    const genAI = new GoogleGenerativeAI('AQ.Ab8RN6JH982-JAmHhGM3SxSu8aQ95GfezG7SCoWl6Pg22xQ5HA');
    const dynamicModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: { parts: [{ text: 'You are a bot.' }] },
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
        maxOutputTokens: 500,
      },
    });

    const chatHistory = [
      { role: 'model', parts: [{ text: 'welcome' }] }
    ];

    const chat = dynamicModel.startChat({
      history: chatHistory,
    });

    console.log('Sending message...');
    const result = await chat.sendMessage('hello');
    console.log('Response:', result.response.text());
  } catch (err) {
    console.error('ERROR:', err);
  }
}

run();
