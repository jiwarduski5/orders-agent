/**
 * telegramService.js
 *
 * Sends Telegram messages to the shop owner via Telegram Bot API.
 * Supports two modes:
 * 1. Formatted order notification (when parsing succeeds)
 * 2. Raw message forwarding (when parsing fails — fallback)
 *
 * Ultra-clear layout designed for instant readability.
 */

const axios = require('axios');

/**
 * Formats the order details into a beautiful, ultra-clear Telegram message (HTML)
 */
function formatTelegramMessage(order, orderNumber, usedAI = false) {
  const brain = usedAI ? '🤖 AI' : '🔧 Regex';
  const missing = (val) => val && val !== '—' && val !== 'غير محدد' && val !== 'يرجى المراجعة' ? val : '⚠️ MISSING';

  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 <b>NEW ORDER #${orderNumber}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `\n` +
    `👤 <b>Name:</b>  ${missing(order.customerName)}\n` +
    `📱 <b>Phone:</b>  ${missing(order.phone)}\n` +
    `📍 <b>Address:</b>  ${missing(order.address)}\n` +
    `🔗 <b>IG User:</b>  @${order.customer}\n` +
    `\n` +
    `───── Order Details ─────\n` +
    `\n` +
    `📦 <b>Product:</b>  ${missing(order.product)}\n` +
    `🔢 <b>Qty:</b>  ${order.quantity || '1'}\n` +
    `📐 <b>Size:</b>  ${missing(order.size)}\n` +
    `🎨 <b>Color:</b>  ${missing(order.color)}\n` +
    `\n` +
    `───── Info ─────\n` +
    `\n` +
    `📅 <b>Date:</b>  ${order.date} - ${order.time}\n` +
    `🧠 <b>Parsed by:</b>  ${brain}\n` +
    `📌 <b>Status:</b>  ${order.status}\n` +
    `\n` +
    `───── Full Message ─────\n` +
    `\n` +
    `💬 "${order.rawMessage}"\n` +
    `\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`
  );
}

/**
 * Formats a raw message block for Telegram (fallback when parsing fails)
 */
function formatRawMessage(senderId, rawText) {
  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📩 <b>NEW MESSAGE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `\n` +
    `🔗 <b>From:</b>  user_${senderId}\n` +
    `📅 <b>Date:</b>  ${new Date().toLocaleString('ar-IQ')}\n` +
    `\n` +
    `───── Message ─────\n` +
    `\n` +
    `💬 "${rawText}"\n` +
    `\n` +
    `⚠️ <b>Could not auto-detect order details</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`
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
async function sendOrderNotification(order, orderNumber, usedAI = false) {
  const message = formatTelegramMessage(order, orderNumber, usedAI);
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

module.exports = { sendOrderNotification, sendRawMessageNotification, sendTelegram };
