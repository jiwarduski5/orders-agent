/**
 * sheetsService.js
 *
 * Writes order data to a Google Sheet.
 * Uses a Service Account so no user login is required.
 */

const { google } = require('googleapis');

// ─── Auth Setup ───────────────────────────────────────────────────────────────
function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// ─── Sheet Header (created on first run if sheet is empty) ────────────────────
const HEADERS = [
  '#',
  'التاريخ',
  'الوقت',
  'المستخدم',
  'الرسالة الكاملة',
  'الكمية',
  'المقاس',
  'اللون',
  'المنتج',
  'رقم المنشور',
  'الحالة',
];

/**
 * Ensures the sheet has a header row.
 * If the sheet is empty, it adds the header first.
 */
async function ensureHeader(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A1:K1',
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [HEADERS] },
    });
    console.log('✅ Sheet header created.');
  }
}

/**
 * Gets the next row number (to auto-increment #)
 */
async function getNextRowNumber(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A:A',
  });
  const rows = res.data.values || [];
  // rows includes the header, so subtract 1 for actual order count
  return Math.max(rows.length - 1, 0) + 1;
}

/**
 * Appends a new order row to the Google Sheet
 * @param {object} order - Parsed order object from orderParser
 */
async function appendOrder(order) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  try {
    await ensureHeader(sheets, spreadsheetId);
    const rowNum = await getNextRowNumber(sheets, spreadsheetId);

    const row = [
      rowNum,
      order.date,
      order.time,
      order.customer,
      order.rawMessage,
      order.quantity,
      order.size,
      order.color || '—',
      order.product,
      order.postId || '—',
      order.status,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:K',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    console.log(`✅ Order #${rowNum} saved to Google Sheets.`);
    return rowNum;
  } catch (error) {
    console.error('❌ Google Sheets error:', error.message);
    throw error;
  }
}

module.exports = { appendOrder };
