const { createClient } = require('redis');

class SessionStore {
  constructor() {
    this.memory = new Map();
    this.phonesMemory = new Map();
    this.redisClient = null;

    if (process.env.REDIS_URL) {
      this.redisClient = createClient({ url: process.env.REDIS_URL });
      this.redisClient.on('error', (err) => console.error('  Redis error:', err));
      this.redisClient.connect()
        .then(() => console.log('  Connected to Redis'))
        .catch((err) => console.error('  Redis connection failed:', err));
    } else {
      console.log('  No Redis URL — using local memory');
    }
  }

  async get(pageId, userId) {
    const key = `convo:${pageId}:${userId}`;
    if (this.redisClient) {
      const data = await this.redisClient.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        parsed.messageIds = new Set(parsed.messageIds || []);
        return parsed;
      }
      return null;
    } else {
      return this.memory.get(key) || null;
    }
  }

  async set(pageId, userId, data) {
    const key = `convo:${pageId}:${userId}`;
    if (this.redisClient) {
      const toSave = { ...data, messageIds: Array.from(data.messageIds || []) };
      await this.redisClient.setEx(key, 86400, JSON.stringify(toSave));
    } else {
      this.memory.set(key, data);
    }
  }

  async delete(pageId, userId) {
    const key = `convo:${pageId}:${userId}`;
    if (this.redisClient) {
      await this.redisClient.del(key);
    } else {
      this.memory.delete(key);
    }
  }

  async recordPhone(pageId, phone, product = '') {
    const cleanPhone = phone.replace(/\s+/g, '');
    const cleanProduct = product.replace(/\s+/g, '').toLowerCase();
    const key = `phone:${pageId}:${cleanPhone}:prod:${cleanProduct}`;
    
    if (this.redisClient) {
      await this.redisClient.setEx(key, 43200, 'ordered');
    } else {
      this.phonesMemory.set(key, Date.now());
      setTimeout(() => this.phonesMemory.delete(key), 43200 * 1000);
    }
  }

  async hasOrderedRecently(pageId, phone, product = '') {
    const cleanPhone = phone.replace(/\s+/g, '');
    const cleanProduct = product.replace(/\s+/g, '').toLowerCase();
    const key = `phone:${pageId}:${cleanPhone}:prod:${cleanProduct}`;
    
    if (this.redisClient) {
      const exists = await this.redisClient.get(key);
      return !!exists;
    } else {
      const timestamp = this.phonesMemory.get(key);
      if (!timestamp) return false;
      const hoursPassed = (Date.now() - timestamp) / (1000 * 60 * 60);
      if (hoursPassed > 12) {
        this.phonesMemory.delete(key);
        return false;
      }
      return true;
    }
  }
}

const sessionStore = new SessionStore();
module.exports = sessionStore;
