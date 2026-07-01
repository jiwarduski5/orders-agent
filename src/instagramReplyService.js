const axios = require('axios');
const { getToken } = require('./clientManager');

async function sendInstagramReply(pageId, recipientId, text) {
  const token = getToken(pageId);

  if (!token) {
    console.warn('  No Instagram token — cant reply');
    return;
  }

  try {
    const response = await axios.post(
      'https://graph.instagram.com/v22.0/me/messages',
      {
        recipient: { id: recipientId },
        message: { text: text }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`  Reply sent to ${recipientId}`);
    return response.data;
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`  Instagram reply failed: ${errMsg}`);
  }
}

module.exports = { sendInstagramReply };
