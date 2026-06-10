/**
 * instagramReplyService.js
 *
 * Sends reply messages back to Instagram users via the Instagram Messaging API.
 * Uses the access token from tokenManager.
 */

const axios = require('axios');
const { getToken } = require('./clientManager');

/**
 * Sends a text message reply to an Instagram user
 * @param {string} recipientId - The Instagram-scoped user ID (IGSID)
 * @param {string} text - The message text to send
 */
async function sendInstagramReply(pageId, recipientId, text) {
  const token = getToken(pageId);

  if (!token) {
    console.warn('⚠️ No Instagram access token available. Cannot reply.');
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

    console.log(`💬 Instagram reply sent to ${recipientId}`);
    return response.data;
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`❌ Instagram reply failed: ${errMsg}`);
    // Don't throw — we don't want a reply failure to crash the webhook
  }
}

module.exports = { sendInstagramReply };
