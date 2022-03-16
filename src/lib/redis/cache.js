const { redisConn } = require("./redisConn");

// const _redisClient = require('./redisClient');

class Cache {
  constructor() {
    this.redis = redisConn();
  }

  async set(key, value, hrs) {
    const ttl = 60 * 60 * hrs;

    let v;

    try {
      v = JSON.stringify(value);
    } catch (err) {
      console.log(err);
    }

    return this.redis.set(key, v, 'EX', ttl);
  }

  async get(key) {
    const cached = await this.redis.get(key);

    return cached ? JSON.parse(cached) : null;
  }

  // Invalidating the cache by a unique key
  invalidate(key) {
    return this.redis.del(key);
  }

  // Invalidating the cache by a prefix of a structure key
  async invalidatePrefix(prefix) {
    // Finding the structure keys by the passed prefix
    const keys = await this.redis.keys(`cache:${prefix}:*`);

    const keysWithoutPrefix = keys.map(key => key.replace('cache:', ''));

    return this.redis.del(keysWithoutPrefix);
  }
}

module.exports = new Cache();
