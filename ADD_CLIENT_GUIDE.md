# 🚀 Master Guide: Adding a New Client

Follow these exact steps every time you sell the bot to someone new.

---

### 🟢 STEP 1: Connect Their Instagram & Facebook 📱
Before the bot can talk, Meta needs to know who it is talking for!
1. **Link Accounts:** Make sure your client's Instagram Professional account is linked to a Facebook Page. *(They can do this in their Instagram App Settings -> Business -> Connect or Create)*.
2. **Get Admin Access:** The client MUST make your personal Facebook account an **Admin** of their Facebook Page so you can connect it to your bot.

---

### 🔵 STEP 2: The Meta Developer Dashboard 🛠️
Now we connect their page to your master bot app.
1. **Login:** Go to [developers.facebook.com](https://developers.facebook.com/) and open your App.
2. **Add the Page:** On the left menu, click **App settings** ➔ **Basic**. Scroll down and make sure you are ready to add pages. (Usually, you go to **Messenger / Instagram API** ➔ **API Setup**).
3. **Generate Token:** Click the **Add Page** button. Select your client's Facebook Page from the list. Once added, click **Generate Token**. 
   * 📝 *Copy this long Token immediately and save it somewhere safe!*
4. **Subscribe to Webhooks:** Right below the token section, find the Webhooks area. Click **Add Subscriptions** next to the new page. Check the box for `messages` and save.
5. **Get the Page ID:** Look at the screen where you just added the page. You will see a string of numbers next to the page name (e.g., `10492837482`). 
   * 📝 *Copy this Page ID!*

---

### 🟡 STEP 3: Setup Google Sheets 📊
Every client gets their own private spreadsheet.
1. **Create the Sheet:** Create a brand new Google Sheet for the client.
2. **Share It:** Click the green "Share" button in the top right. Paste your **Google Service Account Email** (the long email ending in `.iam.gserviceaccount.com` from your `.env` file) and give it "Editor" access.
3. **Get the Sheet ID:** Look at the URL of the Google Sheet. It looks like this: `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0X_1K234567890abcdef`**`/edit`. 
   * 📝 *Copy that long mix of letters and numbers in the middle. That is the Sheet ID!*

---

### 🟣 STEP 4: Setup Telegram 💬
We will use your *existing* Telegram bot to send messages to a new private group.
1. **Create a Group:** Open Telegram and create a new Group Chat. Name it something like "Shop B Orders".
2. **Add Your Bot:** Add your existing Telegram Bot to this new group.
3. **Get the Chat ID:** You need the ID number for this specific group. The easiest way is to add the bot `@RawDataBot` to the group temporarily. It will instantly send a message with the chat info. Look for `"chat": {"id": -100123456789}`. 
   * 📝 *Copy that Chat ID (make sure to include the `-` minus sign if it has one!)*. Once you have it, you can kick `@RawDataBot` out of the group.

---

### 🔴 STEP 5: Add to `clients.json` 💻
You have all the pieces! Now we just put them in the code.
1. Open `clients.json` in your code editor.
2. Add a comma `,` after the last client, and paste your new client's data block. It should look like this:

```json
{
  "123456789_YOUR_PERSONAL_PAGE_ID": {
    "name": "Jiwar Main Shop",
    "token": "EAA_YOUR_TOKEN...",
    "sheetId": "YOUR_SHEET_ID...",
    "telegramChatId": "YOUR_TELEGRAM_ID"
  },
  "10492837482": {
    "name": "Shop B (New Client)",
    "token": "EAA_THEIR_NEW_TOKEN_HERE...",
    "sheetId": "THEIR_GOOGLE_SHEET_ID",
    "telegramChatId": "-100123456789"
  }
}
```
*(Replace all the uppercase text with the real IDs and Tokens you collected in the steps above).*

### 🏁 STEP 6: Push and Celebrate! 🎉
1. Open **GitHub Desktop**.
2. Type a summary like "Added Shop B".
3. Click **Commit** and then **Push origin**.
4. Railway will automatically update in 1-2 minutes.
5. Send a test message to Shop B's Instagram to watch the magic happen! ✨
