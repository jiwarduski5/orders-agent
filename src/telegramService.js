const TelegramBot = require('node-telegram-bot-api');
const { getTelegramChatId } = require('./clientManager');

let bot = null;

function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('  TELEGRAM_BOT_TOKEN missing — Telegram disabled');
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  console.log('  Telegram bot is running');

  bot.on('callback_query', async (query) => {
    const action = query.data;
    const msgId = query.message.message_id;
    const chatId = query.message.chat.id;
    const originalText = query.message.text || '';

    let newText = originalText;
    if (action === 'deliver') {
      newText = '[DELIVERED]\n\n' + newText;
    } else if (action === 'cancel') {
      newText = '[CANCELLED]\n\n' + newText;
    }

    try {
      await bot.editMessageText(newText, {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: { inline_keyboard: [] }
      });
      
      await bot.answerCallbackQuery(query.id, { text: 'Order Updated!' });
    } catch (err) {
      console.error('  Failed to edit Telegram message:', err.message);
    }
  });
}

async function sendTelegram(pageId, text) {
  const chatId = getTelegramChatId(pageId);
  if (!bot || !chatId) {
    console.log('  Telegram not configured — skipping notification');
    return;
  }

  try {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Mark Delivered', callback_data: 'deliver' },
            { text: 'Cancel Order', callback_data: 'cancel' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error(`  Telegram send failed: ${error.message}`);
  }
}

function formatTelegramMessage(order, orderNumber, usedAI = false) {
  const brain = usedAI ? 'AI' : 'Regex';
  const missing = (val) => val && val !== '—' && val !== 'غير محدد' && val !== 'يرجى المراجعة' ? val : 'MISSING';

  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `NEW ORDER #${orderNumber}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `\n` +
    `Name:  ${missing(order.customerName)}\n` +
    `Phone:  ${missing(order.phone)}\n` +
    `Address:  ${missing(order.address)}\n` +
    `IG User:  @${order.customer}\n` +
    `\n` +
    `───── Order Details ─────\n` +
    `\n` +
    `Product:  ${missing(order.product)}\n` +
    `Qty:  ${order.quantity || '1'}\n` +
    `Size:  ${missing(order.size)}\n` +
    `Color:  ${missing(order.color)}\n` +
    `\n` +
    `───── Info ─────\n` +
    `\n` +
    `Date:  ${order.date} - ${order.time}\n` +
    `Parsed by:  ${brain}\n` +
    `Status:  ${order.status}\n` +
    `\n` +
    `───── Full Message ─────\n` +
    `\n` +
    `"${order.rawMessage}"\n` +
    `\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`
  );
}

function formatRawMessage(senderId, rawText) {
  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `NEW MESSAGE\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `\n` +
    `From:  user_${senderId}\n` +
    `Date:  ${new Date().toLocaleString('ar-IQ')}\n` +
    `\n` +
    `───── Message ─────\n` +
    `\n` +
    `"${rawText}"\n` +
    `\n` +
    `Could not auto-detect order details\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`
  );
}

async function sendOrderNotification(pageId, order, orderNumber, usedAI = false) {
  const message = formatTelegramMessage(order, orderNumber, usedAI);
  await sendTelegram(pageId, message);
  console.log(`  Telegram notification sent for order #${orderNumber}`);
}

async function sendRawMessageNotification(senderId, rawText) {
  const message = formatRawMessage(senderId, rawText);
  await sendTelegram(message);
  console.log(`  Raw message forwarded from ${senderId}`);
}

module.exports = { initTelegramBot, sendOrderNotification, sendRawMessageNotification, sendTelegram };
