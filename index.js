const session = require("express-session");

const RedisStore = require("connect-redis")(session);
const process = require('process');

const { Server } = require("./src/dusla/server");
const { JobQueue } = require("./src/lib/jobs/jobqueue");
const { redisConn } = require("./src/lib/redis/redisConn");

process.title = 'budyclub';

(async function() {

  const sess_store = new RedisStore({ client: redisConn(), ttl: 84600 });

  const _sever = new Server({
    secret: 'expensive-session-secret',
    port: process.env.PORT,
    session_store: sess_store,
  });

  _sever.express_app.get('/', (req, res) => {
    res.json({
      message: 'budyclub.com',
    });
  });

  _sever._start();
  await Promise.resolve(_sever._createMediasoupWokers());

  await Promise.all([JobQueue.Instance.start()]);

  process.on('exit', (stream) => {
    console.log(stream);
  })
}());
