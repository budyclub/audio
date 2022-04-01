require("dotenv/config");
const Websocket = require('ws');
const process = require('process');
const debug = require('debug');
const express = require('express');
const session = require('express-session');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { MemoryStore } = require('express-session');
const querystring = require('querystring');

const routes = require('./routes/router');
const { verifyToken } = require('../../utils/auth/tokenAuth');
const { login } = require('../../auth/login');
const LofiManager = require('./LofiManager/LofiManager');
const { createRoom, getRoom } = require('../../database/room');
const { createRoomPeer } = require('../../database/roomPeers');
const cache = require('../../lib/redis/cache');
const { user: getCurrentUser, updateCurrentRoomId } = require("../../database/user");
const { isHTTPSignatureDigestValid } = require("../../utils/crypto/crypto");
const PushNotification = require("../../lib/notifier/pushnotification");

const log = debug("Goliatho:server");
const errLog = debug("Goliatho:ERROR");

const router = express.Router();

class Server extends LofiManager {

  constructor(options) {
    super();
    this.port = options.port ?? 4444;
    this.session_store = options.session_store ?? new MemoryStore();
    this.sess_secret = options.secret ?? 'simple-secret'
    this.express_app = this.buildExpressApp();
    this.http_server = new http.Server();
    this.websocket = new Websocket.Server({ noServer: true });

    /**
     * Map <string, ws>
     */
    this._ws = new Map();
  }


  buildExpressApp() {
    const app = express();

    app.disable('x-powered-by');

    app.set('port', this.port);
    app.use(express.urlencoded({ extended: true }));
    app.set("trust proxy", 1);
    app.use(express.json({
      type: ['application/json', 'application/*+json'],
      limit: '500kb',
      verify: (req, res, buf) => {
        // const valid = isHTTPSignatureDigestValid(buf, req);

        // if (valid !== true) {
        //   // res.fail({
        //   //   status: HttpStatusCode.FORBIDDEN_403,
        //   //   message: 'Invalid digest'
        //   // })
        // }
      },
    }));
    app.use(helmet());
    app.use(session({
      secret: this.sess_secret,
      resave: false,
      rolling: true,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production", httpOnly: false, maxAge: 1000 * 60 * 10 },
      store: this.session_store,
    }));
    app.use(
      cors({
        origin: "*",
        maxAge: 86400,
        credentials: true,
        exposedHeaders: [
          "Access-token",
          "Content-type",
          "Content-length",
        ],
      })
    );

    app.use('/', login());
    app.use('/', routes.rooms());
    app.use('/', routes.userProfile());
    app.use('/', routes.updateUserProfile())
    app.use('/', routes.follow());
    app.use('/', routes.ff());
    app.use('/', routes.setNotification_id());
    app.use('/', routes.updateRoomPermisions());
    app.use('/', routes.updatePeerSpeaker());
    app.use('/', routes.searchUsers());
    app.use('/', router.post('/create-room', async (req, res) => {
      await this.createRoom(req, res).catch(err => errLog('create room error', err));
    }));
    app.use('/', router.get('/room/:room_id/u/:user_id', async (req, res) => {
      await this.joinRoom(req, res).catch(err => errLog('join room error', err));
    }));

    return app;
  }

  _start() {

    /**
       * register express_app for http requests
       */
    this.http_server.on('request', this.express_app);

    /**
       * register websocket server for ws requests
       */

    this.websocket.on('connection', (ws, req) => {
      const { user_id } = req.user_data;

      const _socket = this._ws.set(user_id, ws).get(user_id);

      const msg = this.encodeMsg({
        act: 'we_are_good_to_go',
        user_id,
      });

      _socket.send(msg);

      this.onsocketConnection(_socket, req);
    });

    this.http_server.on('upgrade', (req, skt, head) => {
      const [_, query] = req.url.split('?');
      const params = querystring.parse(query);
      const token = params?.token ?? null;

      if(!token) {
        skt.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        skt.destroy();

        return;
      }

      const u = verifyToken(token);

      req.user_data = u?.data ?? null;

      this.websocket.handleUpgrade(req, skt, head, (sock) => {
        if(!req.user_data) {
          skt.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          skt.destroy();

          return;
        }
        req.__ws = sock;
        this.websocket.emit('connection', sock, req);
      });
    });

    this.http_server.listen(this.port);

    this.http_server.on('listening', () => {
      const addr = this.http_server.address();
      const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;

      log('Server Listening on ' + bind);
    });

    this.http_server.on('error', this.onError);
  }

  onsocketConnection(ws, req) {
    const { user_id } = req.user_data;

    this.lastPing = Date.now();

    const intervalId = setInterval(() => {
      const timeSincePing = Date.now() - this.lastPing;

      if (timeSincePing > 30000) {
        console.log(`Closing websocket after ${timeSincePing} ms:`, user_id);
        ws.terminate();

        return;
      }
      ws?.ping?.();
      ws.send('pong');
    }, 5000 + 1000);

    ws.on('message', (msg) => {
      if(msg === '"ping"' || msg === 'ping') {
        this.lastPing = Date.now();
        console.log('in', msg);

        return;
      }
      this._onMessage(msg, this).catch(err => errLog('onMessage error', err))
    });

    ws.on('error', e => {
      errLog('websocket error onError', e);
      clearInterval(intervalId);
      this._ws.delete(user_id);
    });

    ws.on('close', (reason) => {
      clearInterval(intervalId);
      this._handleOnWsClose(reason, user_id);
    });
  }


  /**
   * Event Listener for websocket on "close" event
   * @param {} reason
   */
  _handleOnWsClose(reason, user_id) {
    log('websocket closed reason', reason);
    this._ws.delete(user_id);
  }

  /**
   * Create new room
   * @param {*}
   */

  async createRoom(req, res) {
    const { description, isPrivate, user_id, name } = req.body;

    const muted_speakers_obj = { [user_id]: true };
    const active_speakers_obj = { [user_id]: false };

    let resp = null;

    /**
     * create room Object
     */
    const roomData = {
      about_room: description,
      is_public: isPrivate,
      created_by_id: user_id,
      room_name: name,
      muted_speakers_obj,
      block_speakers_obj: {},
      speakers: {},
      raise_hand_active: true,
      active_speakers_obj,
      requests: {}
    };

    /**
     * create a speaker Object and attach him required room_permisions
     */
    const peer = {
      user_id,
      room_permisions: {
        requested_to_speak: false,
        isSpeaker: true,
        isMod: true,
      },
      joined_at: Date.now(),
    }

    try {
      resp = await createRoom(roomData, peer);
    } catch (err) {
      errLog('create room error', err);
      res.json({
        msg: err?.message,
        error: err,
      })
    }

    if(!resp) return;

    const { dataValues } = resp;

    res.json({
      act: 'create_room_done',
      room_id: dataValues.room_id
    });

    const { FB_id } = await this._returnUser(user_id);

    const _p = new PushNotification({ ...dataValues, FB_id });

    await _p.sendPushOnNewRoomCreation();

  }

  async joinRoom(req, res) {
    const { room_id, user_id } = req.params;

    let dataValues;

    let isNewRecord;

    /**
     * create a new peer Object
     */
    const peer = {
      user_id,
      room_id,
      room_permisions: {
        requested_to_speak: false,
        isSpeaker: false,
        isMod: false,
      },
      joined_at: Date.now(),
    }

    try {
      [dataValues, isNewRecord] = await createRoomPeer(peer);
    } catch (err) {
      res.json({
        error: err,
        msg: err?.message,
      });
    }

    if(!dataValues) return;
    // when peer is a speaker in the room join him as a speaker.
    const isSpeaker = dataValues.room_permisions.isSpeaker;

    const [room, user] = await Promise.all([
      this.getRoomById(room_id),
      this._returnUser(user_id),
      updateCurrentRoomId(room_id, user_id),
    ]).catch(err => errLog(err));

    this.new_peer = this._returnPeer(dataValues, user);

    const resp = await this._createLofiSfuInstance(room_id, isSpeaker, user_id, this, isNewRecord).catch(err => log(err));

    // for debug purpose
    // console.log('_createLofiSfuInstance', resp);

    res.json({
      act: 'join_room_done',
      ...room,
    });
  }

  async _returnUser(user_id) {
    const key = `current-user:${user_id}`;

    let user = await cache.get(key);

    if(!user) {
      const { dataValues: data_values } = await getCurrentUser(user_id).catch(err => errLog(err));

      await cache.set(key, data_values, 6).catch(err => errLog(err));

      user = data_values;
    }

    return { ...user };
  }

  /**
   * Get a list of all peers in a room
   * @param {UUID} room_id
   */
  peersInRoom(room_id) {
    if(this.lofi_sfu.has(room_id)) {
      const lofi = this.lofi_sfu.get(room_id);

      return lofi.rooms[room_id]?.state ?? {};
    }
  }

  /**
   * get the room
   * @param {String} room_id
   * @returns {Promise}
   */
  async getRoomById(room_id) {
    let room;

    try {
      room = await getRoom(room_id);
    } catch (err) {
      errLog('get room error', err);
    }

    return { ...room.dataValues } ?? {}
  }

  /**
   * Event listener for http server "error" event
   * @param {Error} error
   */

  onError(error) {
    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind = typeof port === 'string' ? 'Pipe ' + this.port : 'Port ' + this.port;

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
   * Event listener for http server "listening" event
   *
   */

  onListening() {
    // const addr = this.http_server.address;
  }

  _returnPeer = ({
    room_id,
    user_id,
    room_permisions,
    joined_at
  }, {
    user_name,
    photo_url,
    FB_id,
    current_room_id,
    full_name,
    num_follower,
    num_following,
    bio
  }) => ({
    room_id,
    user_id,
    room_permisions,
    joined_at,
    user: {
      user_id,
      user_name,
      photo_url,
      FB_id,
      current_room_id,
      full_name,
      num_follower,
      num_following,
      bio
    }
  })

}

module.exports = { Server };
