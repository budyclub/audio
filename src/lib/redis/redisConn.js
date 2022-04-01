const Redis = require('ioredis');
const process = require('process');

function redisConn() {
  let conn = null;

  conn = new Redis({
    keyPrefix: 'cache:',
    host: "127.0.0.1",
    port: 6379,
    password: process.env.REDIS_PASSWORD,
  });

  if(!conn) {
    throw new Error('No Redis Connection');
  }

  return conn;
}

module.exports = { redisConn };
