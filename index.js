// const session = require("express-session");

// const RedisStore = require("connect-redis")(session);
// const _redisClient = require('./src/lib/redis/redisClient');

const { Server } = require("./src/dusla/server");


(async function() {

  // const sess_store = new RedisStore({ client: _redisClient, ttl: 84600 });

  const _sever = new Server({
    secret: 'expensive-session-secret',
    port: 8002
  });

  _sever.express_app.get('/', (req, res) => {
    res.json({
      message: 'budyclub.com',
    });
  });

  _sever._start();
  await Promise.resolve(_sever._createMediasoupWokers());
}());
