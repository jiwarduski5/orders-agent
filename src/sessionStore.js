const { createClient } = require('redis');

class SessionStore {
  constructor() {
    this.memory = new Map();
    this.phonesMemory = new Map();
    this.redisClient = null;

    if (process.env.REDIS_URL) {
      this.redisClient = createClient({ url: process.env.REDIS_URL });
      this.redisClient.on('error', (err) => console.error('Redis Client Error:', err));
      this.redisClient.connect()
        .then(() => console.log('✅ Connected to Redis Database!'))
        .catch((err) => console.error('❌ Failed to connect to Redis:', err));
    } else {
      console.log('⚠️ No REDIS_URL found. Falling back to local RAM memory.');
    }
  }

  // ─── CONVERSATIONS ────────────────────────────────────────────────────────
  async get(userId) {
    if (this.redisClient) {
      const data = await this.redisClient.get(`convo:${userId}`);
      if (data) {
        const parsed = JSON.parse(data);
        // Map messageIds back to a Set
        parsed.messageIds = new Set(parsed.messageIds || []);
        return parsed;
      }
      return null;
    } else {
      return this.memory.get(userId) || null;
    }
  }

  async set(userId, data) {
    if (this.redisClient) {
      // Convert Set to Array before JSON stringify
      const toSave = { ...data, messageIds: Array.from(data.messageIds || []) };
      // Expire session after 24 hours (86400 seconds)
      await this.redisClient.setEx(`convo:${userId}`, 86400, JSON.stringify(toSave));
    } else {
      this.memory.set(userId, data);
    }
  }

  async delete(userId) {
    if (this.redisClient) {
      await this.redisClient.del(`convo:${userId}`);
    } else {
      this.memory.delete(userId);
    }
  }

  // ─── DUPLICATE GUARD (PHONES) ─────────────────────────────────────────────
  // We keep phone numbers for 12 hours (43200 seconds) to block duplicates
  async recordPhone(phone) {
    // Standardize phone number by removing spaces
    const cleanPhone = phone.replace(/\s+/g, '');
    if (this.redisClient) {
      await this.redisClient.setEx(`phone:${cleanPhone}`, 43200, 'ordered');
    } else {
      this.phonesMemory.set(cleanPhone, Date.now());
      // Lazy cleanup for local memory
      setTimeout(() => this.phonesMemory.delete(cleanPhone), 43200 * 1000);
    }
  }

  async hasOrderedRecently(phone) {
    const cleanPhone = phone.replace(/\s+/g, '');
    if (this.redisClient) {
      const exists = await this.redisClient.get(`phone:${cleanPhone}`);
      return !!exists;
    } else {
      const timestamp = this.phonesMemory.get(cleanPhone);
      if (!timestamp) return false;
      const hoursPassed = (Date.now() - timestamp) / (1000 * 60 * 60);
      if (hoursPassed > 12) {
        this.phonesMemory.delete(cleanPhone);
        return false;
      }
      return true;
    }
  }
}

const sessionStore = new SessionStore();
module.exports = sessionStore;
