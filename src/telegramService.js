/**
 * telegramService.js
 *
 * Sends Telegram messages to the shop owner via Telegram Bot API.
 */

const axios = require('axios');

/**
 * Formats the order details into a readable Telegram message
 * @param {object} order - Parsed order from orderParser
 * @param {number} orderNumber - The row number from Google Sheets
 * @returns {string} Formatted message text
 */
function formatTelegramMessage(order, orderNumber) {
  const colorLine = order.color ? `\n🎨 اللون: ${order.color}` : '';

  return (
    `🛒 *طلب جديد #${orderNumber}*\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👤 الزبون: @${order.customer}\n` +
    `📅 التاريخ: ${order.date} - ${order.time}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🔢 الكمية: ${order.quantity}\n` +
    `📐 المقاس: ${order.size}` +
    colorLine +
    `\n━━━━━━━━━━━━━━━\n` +
    `💬 الرسالة:\n"${order.rawMessage}"\n` +
    `━━━━━━━━━━━━━━━\n` +
    `📌 الحالة: ${order.status}`
  );
}

/**
 * Sends a Telegram text message to the shop owner
 * @param {object} order - Parsed order
 * @param {number} orderNumber - Sheet row number
 */
async function sendOrderNotification(order, orderNumber) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('⚠️ Telegram credentials missing. Skipping notification.');
    return;
  }

  const message = formatTelegramMessage(order, orderNumber);

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      }
    );

    console.log(`✅ Telegram notification sent for order #${orderNumber}.`);
    return response.data;
  } catch (error) {
    const errMsg = error.response?.data?.description || error.message;
    console.error(`❌ Telegram send failed: ${errMsg}`);
    // We don't throw error here so it doesn't crash the webhook response
  }
}

module.exports = { sendOrderNotification };
