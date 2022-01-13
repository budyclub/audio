/* eslint-disable no-undef */
/* eslint-disable no-process-exit */

'use strict';

const debug = require('debug');

require("dotenv/config");
const session = require('cookie-session');
const express = require('express');
// eslint-disable-next-line new-cap
const router = express.Router();
const bodyParser = require('body-parser');
const http = require('http');
const auth = require('./auth');
const cors = require('cors');
const helmet = require('helmet');
const { startCassandra, getAllRooms } = require('./cassandra');
const WebsocketServer = require('./utils/ws/Websocket');
// const db = require('./models');
const { Router } = require('express');
const log = debug("Goliatho:server");
const errLog = debug("Goliatho:ERROR");
const {
  user,
  insertFollows,
  getUser,
  getFollowFollowers,
  updateNotifiactionId,
  getNotificationIds
} = require('./database/user');

const { createMessage, sendPushNotif } = require('./node-gcm/push-notification');

const app = express();


((async function() {
  // start cassandra
  await startCassandra();
  // const msg = createMessage({
  //   title: `New User Onboarding Budyclub🏠`,
  //   icon: "ic_launcher",
  //   body: `Welcome to Budyclub 👋 Listen to Rnb, Rhumba,🕺💃 Lofi, Mediation🧘‍♂️🧘‍♀️ and Gospel Music 📖`
  // });

  // msg.addData({
  //   click_action: `https://budyclub.app/room/9fc399e0-9a62-455c-ba35-54ad4f122ff2`,
  //   imgUrl: 'https://placedog.net/640/480?random',
  //   room_id: '1234567890',
  //   type: 'push',
  // });

  // sendPushNotif(msg, ['cElSV2AVSMScqYdvzNpG1-:APA91bHmgHU0DTGRWo9D2acR_a9I-3WcfEEv-gK56WbJMeHL9U556OVbnjd2cHUMx8Z4ZHgCM4hpaRoQXRXwEx9Wts-IOHMNJsIitds9BvPYTOiBEWdWP0O0tBIZvnM5PHCIeyvWMUG6'])

})());

/**
 * Get the Port number from .env and store it in Express.
 */

const port = normalizePort(process.env.PORT || '3008');

app.set('port', port);

/**
 * Create a session parser for express.
 */
const sessionParser = session({
  saveUninitialized: false,
  secret: '$eCuRiTy',
  resave: false
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("trust proxy", 1);
app.use(sessionParser);
app.use(helmet());
app.use(
  cors({
    origin: "*",
    maxAge: 86400,
    exposedHeaders: [
      "access-token",
      "content-type",
      "content-length",
    ],
  })
);
function r() {
  return router.post('/', async (req, res) => {
    const rooms = await getAllRooms();

    try {
      const data = JSON.parse(rooms, true);

      res.json(data);
    } catch (err) {
      errLog(err);
    }
  });
}

function u() {
  return router.get('/user/:id', async (req, res) => {
    // get the user by user name, uuid or email
    const { id } = req.params;

    const resp = await getUser(id);

    console.log('following', resp?.dataValues?.following?.length);
    console.log('followers', resp?.dataValues?.follower?.length);

    res.json(resp?.dataValues);
  });
}

function ff() {
  return router.get('/followers-following/:id/:r', async (req, res) => {
    const { id, r } = req.params;
    const resp = await getFollowFollowers(id, r);

    res.json(resp);
  });
}

function follow() {
  return router.post('/follow', async (req, res) => {
    const { id_followed, id_following, act } = req.body;

    const resp = await insertFollows(id_followed, id_following, act);

    res.json(resp);
  });
}


function setNotification_id() {
  return router.put('/savedevicetoken/:user_id', async (req, res) => {
    const { user_id } = req.params;
    const { token } = req.body;

    const resp = await updateNotifiactionId(token, user_id);

    res.json(resp);
  });
}
app.use('/', auth);
app.use('/rooms', r());
app.use('/', u());
app.use('/', follow());
app.use('/', ff());
app.use('/', setNotification_id());


/**
   * Create a HTTP Server
   */
const server = http.createServer(app);

/**
   * Listen on provided port, on all network interfaces.
   */
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      errLog(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      errLog(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

async function onListening() {
  const addr = server.address();
  const wsServer = new WebsocketServer(server, {});

  await wsServer.startSfu();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;

  log('Listening on ' + bind);
}
