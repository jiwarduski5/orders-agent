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

/**
 * telegramService.js
 *
 * Sends Telegram messages to the shop owner via Telegram Bot API.
 * Uses node-telegram-bot-api for long polling to handle Admin buttons.
 */

const TelegramBot = require('node-telegram-bot-api');

let bot = null;

/**
 * Initialize the Telegram bot (called once from server.js)
 */
function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN missing. Telegram dashboard disabled.');
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  console.log('✅ Telegram Admin Bot is running...');

  // Listen for button clicks
  bot.on('callback_query', async (query) => {
    const action = query.data; // 'deliver' or 'cancel'
    const msgId = query.message.message_id;
    const chatId = query.message.chat.id;
    const originalText = query.message.text || ''; // text (stripped of HTML tags by Telegram API)

    // Append the status indicator to the text
    let newText = originalText;
    if (action === 'deliver') {
      newText = '✅ [DELIVERED]\n\n' + newText;
    } else if (action === 'cancel') {
      newText = '❌ [CANCELLED]\n\n' + newText;
    }

    try {
      // Edit the message: replace it with plain text + no keyboard
      await bot.editMessageText(newText, {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: { inline_keyboard: [] } // removes the buttons
      });
      
      // Acknowledge the callback
      await bot.answerCallbackQuery(query.id, { text: 'Order Updated!' });
    } catch (err) {
      console.error('❌ Failed to edit Telegram message:', err.message);
    }
  });
}

/**
 * Sends a Telegram text message with Admin buttons
 */
async function sendTelegram(text) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!bot || !chatId) {
    console.log('⚠️ Telegram bot not initialized or chat ID missing. Skipping notification.');
    return;
  }

  try {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Mark Delivered', callback_data: 'deliver' },
            { text: '❌ Cancel Order', callback_data: 'cancel' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error(`❌ Telegram send failed: ${error.message}`);
  }
}

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

async function sendOrderNotification(order, orderNumber, usedAI = false) {
  const message = formatTelegramMessage(order, orderNumber, usedAI);
  await sendTelegram(message);
  console.log(`✅ Telegram notification sent for order #${orderNumber}.`);
}

async function sendRawMessageNotification(senderId, rawText) {
  const message = formatRawMessage(senderId, rawText);
  await sendTelegram(message);
  console.log(`📤 Raw message forwarded to Telegram from ${senderId}.`);
}

module.exports = { initTelegramBot, sendOrderNotification, sendRawMessageNotification, sendTelegram };

