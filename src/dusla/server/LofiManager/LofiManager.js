const { EventEmitter } = require("eventemitter3");
const mediasoup = require('mediasoup');
const debug = require('debug');

const LofiSfu = require('../../../lofi-sfu/Lofi');
const config = require('../../../lofi-sfu/config');
const { Server } = require("..");
const { deletePeer, _updatePeerRoomPermisions, _updatePeerSpeaker } = require("../../../database/roomPeers");
const { getRoomCreator, removeRoom, updateRoom } = require("../../../database/room");
const { user: getCurrentUser, insertFollows } = require("../../../database/user");
const { createRoomMessage } = require("../../../database/roomMessages");

const log = debug("Goliatho:lofi-manager");
const errLog = debug("Goliatho:lofi-manager-error");

class LofiManager extends EventEmitter {
  constructor() {
    super();

    /**
     * room <room_id, set<user_id>>
     */
    this.roomPeers = new Map();

    /**
     * Map <room_id, Lofi>
     */
    this.lofi_sfu = new Map();

    /**
     * mediasoup workers
     * @type {Array}
     */
    this.worker_routers = [];
  }

  /**
   *
   * @param {Object} message
   * @param {Server} ctx
   */
  async _onMessage(msg, ctx) {
    let message;

    let room_peers;

    try {
      message = JSON.parse(msg);
    } catch (err) {
      errLog('Json parse error', err);
    }

    const { dt: data, act, ref_id } = message;

    const lofi = this.lofi_sfu.has(data.room_id) ? this.lofi_sfu.get(data.room_id) : null;
    const pWs = ctx._ws.has(data.user_id) ? ctx._ws.get(data.user_id) : null;

    if(lofi) {
      room_peers = lofi.rooms[data.room_id]?.state ?? {};
    }

    switch (act) {
      case 'request_to_speak': {
        // get room creater TODO even moderators
        const resp = await getRoomCreator(data.room_id).catch(err => errLog('error getting room creator', err));

        if (!resp?.created_by_id) {
          return;
        }

        const { dataValues } = await getCurrentUser(data.user_id).catch(err => errLog('error getting curent user', err));

        /*
        * send mod or current room owner list of pple who want to speak,
        * the mod or current room owner must be online.
        */
        const { user_name, photo_url, num_follower, bio, FB_id } = dataValues;

        const ws = ctx._ws.has(resp.created_by_id);

        if(ws) {
          await this.sendWsMsg(ctx._ws.get(resp.created_by_id), this.encodeMsg(
            { act: 'onRequest',
              dt: { ...data, user: { user_name, photo_url, num_follower, bio, FB_id } }, }
          )).catch(err => errLog('error sending onRequest', err));
        }

        break;
      }
      case 'add_speaker': {

        const resp = await lofi.add_speaker(data.room_id, data.user_id)
          .catch(err => errLog(err));

        if(!resp) return;

        const msg = this.encodeMsg({
          act: "on_added_as_speaker",
          dt: {
            ...resp,
            room_id: data.room_id,
          },
          user_id: data.user_id,
        });

        const ws = ctx._ws.has(data.user_id);

        if(!ws) return;

        await this.sendWsMsg(ctx._ws.get(data.user_id), msg);

        const newPeer = this.encodeMsg({
          act: 'new_peer_speaker',
          dt: { ...data }
        })

        for await (const peer of Object.keys(room_peers)) {
          if(ctx._ws.has(peer)) {

            this.sendWsMsg(ctx._ws.get(peer), newPeer);
          }
        }
        await _updatePeerRoomPermisions(data.room_id, data.user_id, true).catch(err => errLog(err));
        break;
      }
      case 'leave_room': {
        if(lofi) {
          await lofi.leave_room(data.room_id, data.user_id)
            .catch(err => errLog(err))
            .then((d) => {
              for (const peer of Object.keys(room_peers)) {
                if(ctx._ws.has(peer)) {
                  const ws = ctx._ws.get(peer);

                  this.sendWsMsg(ws, this.encodeMsg(d));
                }
              }
            })
            .finally(() => {

            });
        }
        // remove the peer from data base.
        await deletePeer(data.user_id, data.room_id)
          .catch(err => errLog(err))
          .then((resp) => log('peer left', resp));
        break;
      }

      case 'mute': {
        const { isMuted, room_id, user_id } = data;

        for await(const peer of Object.keys(room_peers)) {
          if(ctx._ws.has(peer)) {
            const ws = ctx._ws.get(peer);

            this.sendWsMsg(ws, this.encodeMsg({
              act: 'onmute',
              dt: { ...data }
            }));
          }
        }
        await _updatePeerSpeaker(room_id, user_id, isMuted, 'muted_speakers_obj').catch(err => errLog(err));
        break;
      }

      case 'remove_speaker': {
        const resp = await lofi.remove_speaker(data.room_id, data.user_id).catch(err => errLog(err));

        log(resp);
        if(!resp) return;

        for await(const peer of Object.keys(room_peers)) {
          if(ctx._ws.has(peer)) {
            await this.sendWsMsg(ctx._ws.get(peer), this.encodeMsg(resp));
          }
        }

        await Promise.all([
          _updatePeerRoomPermisions(data.room_id, data.user_id, false),
          _updatePeerSpeaker(data.room_id, data.user_id, false, 'active_speakers_obj')
        ])
        break;
      }

      case 'destroy_room': {
        const resp = await lofi.destroy_room(data.room_id, data.user_id).catch(err => errLog(err));

        for await (const peer of Object.keys(room_peers)) {
          if(peer === data.user_id) {
            continue;
          }
          if(ctx._ws.has(peer)) {
            await this.sendWsMsg(ctx._ws.get(peer), this.encodeMsg(resp));
          }
        }

        await removeRoom(data.room_id);
        break;
      }

      case 'updateroominfo': {
        let resp;

        for await(const peer of Object.keys(room_peers)) {
          if(ctx._ws.has(peer)) {
            await this.sendWsMsg(ctx._ws.get(peer), this.encodeMsg({
              act: 'roominfochange',
              dt: data,
            }));
          }
        }
        await updateRoom(data).then((res) => {
          resp = res;
        })
          .catch(err => errLog(err))

        log(resp);
        break;
      }

      case 'follow_unfollow': {
        const resp = await insertFollows(data?.id_followed, data?.id_following, data?.action)
          .catch(err => errLog(err));

        if(!pWs) {
          return Promise.reject(new Error('No websocket connection'))
        }
        await this.sendWsMsg(pWs, this.encodeMsg({
          act: 'follow_unfollow_done',
          dt: resp
        }));
        break;
      }
      case 'send_chat_msg': {
        const { user_name, FB_id } = await ctx._returnUser(data.user_id);

        const msgData = {
          _id: data._id,
          ...data.message,
          user: {
            _id: data.user_id,
            name: user_name,
            avatar: `https://graph.facebook.com/${FB_id}/picture?type=large`,
          }
        };

        for await(const peer of Object.keys(room_peers)) {
          if(ctx._ws.has(peer)) {
            await this.sendWsMsg(ctx._ws.get(peer), this.encodeMsg({
              act: `new_chat_msg_${data.room_id}`,
              dt: msgData,
            }));
          }
        }

        await createRoomMessage({
          room_id: data.room_id,
          user_id: data.user_id,
          message: msgData,
          mentions: {},
        }).catch(err => errLog(err));

        break;
      }
      case '@connect_transport': {
        console.log(act, data);
        try {
          await lofi.connect_transport({ ...data, peer_id: data.user_id }, data.user_id, ctx);
        } catch (err) {
          errLog(act, err);
        }
        break;
      }

      case '@send_track': {
        console.log(act, data);
        try {
          await lofi.send_tracks({ ...data, peer_id: data.user_id }, data.user_id, ctx);
        } catch (err) {
          errLog(act, err);
        }
        break;
      }

      case '@recv_tracks': {
        console.log(act, data);
        try {
          await lofi.recv_tracks({ ...data, peer_id: data.user_id }, data.user_id, ctx);
        } catch (err) {
          errLog(act, err);
        }
        break;
      }

      case '@restartIce': {

        break;
      }

      case 'reconnect_to_lofi': {
        const { user_id, room_id, isSpeaker } = data;

        if(!pWs) {
          errLog('no websocket connection for', user_id);

          return;
        }
        await this._joinRoom(isSpeaker, room_id, user_id, lofi, pWs);
        break;
      }

      case 'room_invite': {
        const{ user_id, room_id, inviter_id } = data;

        break;
      }

      default: {

        break;
      }
    }
  }

  /**
   * Function that creates lofi instance
   * @param {*} room_id
   * @param {*} isSpeaker
   * @param {*} peer_id
   * @param {Server} ws
   * @param {Boolean} iSnewpeer
   * @returns {Promise}
   */
  async _createLofiSfuInstance(room_id, isSpeaker, peer_id, ws, iSnewpeer) {
    let lofi = null;

    let _ws = null;

    if(!ws._ws.has(peer_id)) {
      return Promise.reject(new Error('You do not have websocket connection.'));
    }

    _ws = ws._ws.get(peer_id);

    const isLofi = this.lofi_sfu.has(room_id);

    if (!isLofi && !lofi) {
      await Promise.all([LofiSfu.createRoom(this.worker_routers, room_id)]).catch((err) => {
        console.log(err);
      })
        .then(([Lofi]) => {
          lofi = Lofi;
          this.lofi_sfu.set(room_id, Lofi);
          this.signalSpeakingChangeToAllPeersInRoom(room_id, lofi, ws);
        });
    } else {
      lofi = this.lofi_sfu.get(room_id);
    }

    if(!lofi) {
      return Promise.reject(new Error('Lofi instance is not yet created!'));
    }

    await this._joinRoom(isSpeaker, room_id, peer_id, lofi, _ws).catch(err => errLog(err));

    const { state } = lofi.rooms[room_id];

    if(iSnewpeer) {
      for await (const peer of Object.keys(state)) {
        if(peer === peer_id) continue;
        if(ws._ws.has(peer)) {
          await this.sendWsMsg(ws._ws.get(peer), this.encodeMsg({
            act: 'new_peer',
            dt: { ...ws.new_peer }
          }));
        }
      }
    }
  }

  /**
   *
   * @param {Boolean} isSpeaker
   * @param {String} room_id
   * @param {String} peer_id
   * @param {LofiSfu} lofi
   * @param {Server} ws
   * @returns {Promise<Boolean>}
   */
  async _joinRoom(isSpeaker, room_id, peer_id, lofi, ws) {
    let resp;

    let act;

    if(isSpeaker) {
      act = 'you_joined_as_speaker';
      resp = await lofi.join_as_speaker(room_id, peer_id);
    }

    if(!isSpeaker) {
      act = "joined_as_listener";
      resp = await lofi.join_room_as_listener(room_id, peer_id);
    }

    const msg = this.encodeMsg({ act, dt: { ...resp, peer_id, room_id } });

    return await this.sendWsMsg(ws, msg);
  }

  /**
   *
   * @param {String} room_id
   * @param {LofiSfu} lofi
   * @param {Server} ws
   */
  async signalSpeakingChangeToAllPeersInRoom(room_id, lofi, ws) {

    const { state } = lofi.rooms[room_id];

    lofi.audioLevelObserver.on('volumes', (volumes) => {
      const { producer: { appData: { peer_id, transportId } }, volume } = volumes[0];

      // console.log('audioLevelObserver [volume:"%s"]', volume, appData);

      for (const peer of Object.keys(state)) {
        if(ws._ws.has(peer)) {
          const peerWs = ws._ws.get(peer);

          this.sendWsMsg(peerWs, this.encodeMsg({
            act: `onactivespeaker-${room_id}`,
            dt: { user_id: peer_id, room_id, volume },
          }));
        }
      }

    });

    lofi.audioLevelObserver.on('silence', (silence) => {
      console.log('on silence [silence:"%s"]', silence);

      this.emit(`${room_id}`, { silence });
    });

    lofi.activeSpeakerObserver.on('dominantspeaker', (dps) => {
      const { producer: { appData: { peer_id, transportId } } } = dps;

      console.log('dominantSpeaker [spk: "%s"]', appData);
      this.emit(`${room_id}`, dps);

      Promise.resolve(_updatePeerSpeaker(room_id, peer_id, true, 'active_speakers_obj'));
    });
  }

  async sendWsMsg(ws, encodedMsg) {

    return new Promise((resolve, reject) => {
      ws.send(encodedMsg, { compress: false, binary: false }, error => {
        if(error) {
          reject(new Error(error));
        }
        resolve(true);
      });
    });
  }

  encodeMsg(msg) {
    try {
      return JSON.stringify(msg, true);
    } catch (err) {
      errLog('json parser error');
    }
  }

  async _createMediasoupWokers() {
    for (let i = 0; i < config.mediasoup.numWorkers; i += 1) {
      const worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.workerSettings.logLevel,
        logTags: config.mediasoup.workerSettings.logTags,
        rtcMinPort: config.mediasoup.workerSettings.rtcMinPort,
        rtcMaxPort: config.mediasoup.workerSettings.rtcMaxPort,
      });

      worker.on('died', () => {
        console.error('mediasoup worker died (this should never happen)');

        process.exit(1);
      });

      const mediaCodecs = config.mediasoup.router.mediaCodecs;
      const router = await worker.createRouter({ mediaCodecs });

      this.worker_routers.push({ worker, router });
    }
  }
}

module.exports = LofiManager;
