const KEY_COUNT = 5;
let keys = [];
let currentIndex = 0;
let usageCount = new Array(KEY_COUNT).fill(0);

function initKeys() {
  for (let i = 1; i <= KEY_COUNT; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) keys.push(key);
  }

  if (keys.length === 0) {
    const fallback = process.env.GEMINI_API_KEY;
    if (fallback) keys.push(fallback);
  }

  if (keys.length > 0) {
    console.log(`  Loaded ${keys.length} Gemini API key(s) for rotation`);
  } else {
    console.log('  No Gemini API keys found — AI mode will be disabled');
  }

  return keys.length > 0;
}

function getKey() {
  if (keys.length === 0) return null;
  const key = keys[currentIndex];
  usageCount[currentIndex]++;
  return key;
}

function rotate() {
  if (keys.length <= 1) return false;
  const oldIndex = currentIndex;
  currentIndex = (currentIndex + 1) % keys.length;
  console.log(`  Rotated from key #${oldIndex + 1} to key #${currentIndex + 1}`);
  return true;
}

function getKeyCount() {
  return keys.length;
}

function getStatus() {
  return keys.map((_, i) => ({
    key: i + 1,
    used: usageCount[i],
    active: i === currentIndex,
  }));
}

module.exports = { initKeys, getKey, rotate, getKeyCount, getStatus };
