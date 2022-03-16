const Redis = require('ioredis');

function redisConn() {
  return new Redis({
    keyPrefix: 'cache:',
    host: "127.0.0.1",
    port: 6379,
    password: "hd8qu31chmcu39gwuk27s9b9allnc93u4m7umu8c2t",
  });
}

module.exports = { redisConn };
