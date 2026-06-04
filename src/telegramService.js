/**
 * telegramService.js
 *
 * Sends Telegram messages to the shop owner via Telegram Bot API.
 * Supports two modes:
 * 1. Formatted order notification (when parsing succeeds)
 * 2. Raw message forwarding (when parsing fails — fallback)
 */

const axios = require('axios');

/**
 * Formats the order details into a readable Telegram message (HTML)
 */
function formatTelegramMessage(order, orderNumber) {
  const phoneLine = order.phone ? `\n📱 الهاتف: ${order.phone}` : '';
  const addressLine = order.address ? `\n📍 العنوان: ${order.address}` : '';
  const nameLine = order.customerName ? `\n👤 الاسم: ${order.customerName}` : '';
  const colorLine = order.color ? `\n🎨 اللون: ${order.color}` : '';

  return (
    `🛒 <b>طلب جديد #${orderNumber}</b>\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🔗 الزبون: @${order.customer}` +
    nameLine +
    phoneLine +
    addressLine +
    `\n━━━━━━━━━━━━━━━\n` +
    `📅 التاريخ: ${order.date} - ${order.time}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🔢 الكمية: ${order.quantity}\n` +
    `📐 المقاس: ${order.size}` +
    colorLine +
    `\n━━━━━━━━━━━━━━━\n` +
    `💬 الرسالة الكاملة:\n"${order.rawMessage}"\n` +
    `━━━━━━━━━━━━━━━\n` +
    `📌 الحالة: ${order.status}`
  );
}

/**
 * Formats a raw message block for Telegram (fallback when parsing fails)
 */
function formatRawMessage(senderId, rawText) {
  return (
    `📩 <b>رسالة جديدة</b>\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🔗 من: user_${senderId}\n` +
    `📅 الوقت: ${new Date().toLocaleString('ar-IQ')}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💬 الرسالة:\n"${rawText}"\n` +
    `━━━━━━━━━━━━━━━\n` +
    `⚠️ لم يتم التعرف على الطلب تلقائياً`
  );
}

/**
 * Sends a Telegram text message
 */
async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('⚠️ Telegram credentials missing. Skipping notification.');
    return;
  }

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      }
    );

    return response.data;
  } catch (error) {
    const errMsg = error.response?.data?.description || error.message;
    console.error(`❌ Telegram send failed: ${errMsg}`);
  }
}

/**
 * Sends a formatted order notification to Telegram
 */
async function sendOrderNotification(order, orderNumber) {
  const message = formatTelegramMessage(order, orderNumber);
  await sendTelegram(message);
  console.log(`✅ Telegram notification sent for order #${orderNumber}.`);
}

/**
 * Sends a raw message notification to Telegram (fallback)
 */
async function sendRawMessageNotification(senderId, rawText) {
  const message = formatRawMessage(senderId, rawText);
  await sendTelegram(message);
  console.log(`📤 Raw message forwarded to Telegram from ${senderId}.`);
}

module.exports = { sendOrderNotification, sendRawMessageNotification };
