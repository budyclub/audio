const { createClient } = require('redis');

async function _redisClient() {
  const redisClient = createClient({ legacyMode: true });

  redisClient.on('error', (err) => console.log('Redis Client Error', err));

  await redisClient.connect();

  return redisClient;
}

module.exports = _redisClient;
