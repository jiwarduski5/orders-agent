let keys = [];

function initKeys() {
  for (let i = 1; i <= 5; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) keys.push(key);
  }

  if (keys.length === 0) {
    const fallback = process.env.GEMINI_API_KEY;
    if (fallback) keys.push(fallback);
  }

  if (keys.length > 0) {
    console.log(`  Loaded ${keys.length} Gemini API key(s)`);
  }

  return keys.length > 0;
}

function getAllKeys() {
  return [...keys];
}

function getKeyCount() {
  return keys.length;
}

module.exports = { initKeys, getAllKeys, getKeyCount };
