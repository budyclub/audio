const session = require("express-session");
const Redis = require('ioredis');
const RedisStore = require("connect-redis")(session);

const { Server } = require("./src/dusla/server");


(async function() {

  const sess_store = new RedisStore({ client: new Redis(), ttl: 84600 });

  const _sever = new Server({
    secret: 'expensive-session-secret',
    port: 8003,
    session_store: sess_store,
  });

  _sever.express_app.get('/', (req, res) => {
    res.json({
      message: 'budyclub.com',
    });
  });

  _sever._start();
  await Promise.resolve(_sever._createMediasoupWokers());
}());
