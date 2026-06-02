# 🛒 Instagram Order Agent

Automatically collects orders from Instagram comments and DMs, saves them to Google Sheets, and sends WhatsApp notifications to the shop owner.

## Supports Arabic and Kurdish order detection

---

## Project Structure

```
src/
├── server.js          → Main Express server (entry point)
├── webhookHandler.js  → Receives Instagram events from Meta
├── orderParser.js     → Detects and parses Arabic/Kurdish orders
├── sheetsService.js   → Saves orders to Google Sheets
├── whatsappService.js → Sends WhatsApp notifications
└── tokenManager.js    → Auto-refreshes Instagram token every 50 days
```

---

## Setup (Per Client)

### 1. Copy .env.example to .env
```bash
cp .env.example .env
```

### 2. Fill in the .env file:
- `META_APP_ID` + `META_APP_SECRET` → From Meta Developer Console
- `WEBHOOK_VERIFY_TOKEN` → Any random string you choose
- `INSTAGRAM_ACCESS_TOKEN` → From Meta OAuth
- `INSTAGRAM_PAGE_ID` → From Meta Business Suite
- `WHATSAPP_API_TOKEN` → From Meta Developer Console → WhatsApp
- `WHATSAPP_PHONE_NUMBER_ID` → From Meta WhatsApp setup
- `WHATSAPP_RECIPIENT_NUMBER` → Shop owner's number (no + sign)
- `GOOGLE_SHEET_ID` → From the Google Sheet URL
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` → From Google Cloud

### 3. Install & Start
```bash
npm install
npm start
```

### 4. Set up Meta Webhook
- Go to Meta Developer Console → Your App → Webhooks
- Add your server URL: `https://your-app.onrender.com/webhook`
- Verify token: same as `WEBHOOK_VERIFY_TOKEN` in your .env
- Subscribe to: `comments` and `messages`

---

## Deployment (Render.com Free)

1. Push this code to GitHub
2. Go to render.com → New Web Service
3. Connect your GitHub repo
4. Set all environment variables from .env
5. Deploy

---

## What the Google Sheet Looks Like

| # | Date | Time | Customer | Message | Qty | Size | Color | Product | Post | Status |
|---|------|------|----------|---------|-----|------|-------|---------|------|--------|
| 1 | 01/06/2026 | 00:41 | @ahmed | أريد قميص أزرق | 1 | L | أزرق | يرجى المراجعة | 123 | 🟡 جديد |

---

## What the WhatsApp Notification Looks Like

```
🛒 طلب جديد #1
━━━━━━━━━━━━━━━
👤 الزبون: @ahmed
📅 التاريخ: 01/06/2026 - 00:41
━━━━━━━━━━━━━━━
🔢 الكمية: 1
📐 المقاس: L
🎨 اللون: أزرق
━━━━━━━━━━━━━━━
💬 الرسالة:
"أريد قميص أزرق مقاس L"
━━━━━━━━━━━━━━━
📌 الحالة: 🟡 جديد
```
