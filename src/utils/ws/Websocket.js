/* eslint-disable no-undef */
const debugModule = require('debug');
const { EventEmitter } = require('eventemitter3');
const WebSocket = require('ws');
// const amqp = require('amqplib');
const querystring = require('querystring');
const { v4: uuidV4 } = require('uuid');

const mediasoup = require('mediasoup');
const config = require('../../lofi-sfu/config');

const { verifyToken } = require('../auth/tokenAuth');
const { rep_code } = require('../../config/reply_codes');
const { ACTION_CODE_FUNCTION, AUTH_FUNCTION } = require('../../config/action_codes');

const Collection = require('../../utils/collection/Collection');
const Room = require('../../lib/room/Room');
const User = require('../../lib/users/Users');
const Activerooms = require('../../lib/room/Activerooms');
const UsersInRoom = require('../../lib/users/UsersInRoom');
const RoomMessages = require('../../roomMessages/RoomMessages');
const { insertFollows, getUser, getFollowFollowers, updateUserProfile } = require('../../database/user');
const {
  _creatRoom,
  _joinRoom,
  updateUserRoomPermisons,
  setActiveSpeaker,
  _delActiveSpeaker,
  _addMuteMap,
  _delMuteMap,
  _setMuteMap,
  deleteRoom,
  deleteUsersInRoom,
  leaveRoom,
} = require('../../cassandra/');


const { user: getCurrentUser, userNotificationId, getNotificationIds } = require('../../database/user');

const { createMessage, sendPushNotif } = require('../../node-gcm/push-notification');

const debug = debugModule('Goliatho:index');
const Lofi = require('../../lofi-sfu/Lofi');


/**
 * Represents the main Websocket Server
 * @extends EventEmitter
 * @prop {Object} options Websocket options
 */
class WebsocketConnection {

  /**
   * Creates an instance of EventServer.
   *
   * @param {HttpServer} server - to which server to attach the websocket handlers
   * @param {Array} act[] -
   * @memberof WebsocketConnection
   * @constructor
   */
  constructor(server) {
    this.ws_User = {};
    this.room = new Collection(Room);
    this.options = {
      retryInterval: 5000,
    };

    /**
     * mediasoup workers
     * @type {Array}
     */
    this.worker_routers = [];

    /**
     * Websocket connections initialization
     */
    this.wss = new WebSocket.Server({ noServer: true });
    this.wss.on('connection', (ws, req) => {
      const { user_id } = req;

      this.ws_User[user_id] = { ws, room: null };
      this._onSocketConnection(this.ws_User[user_id]?.ws, user_id);
    });
    server.on('upgrade', (req, skt, head) => {
      const [_, query] = req.url.split('?');
      const params = querystring.parse(query);
      const { token } = params;

      if(!token) {
        skt.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        skt.destroy();

        return;
      }
      const u = verifyToken(token);

      req.user_id = u.data;
      this.wss.handleUpgrade(req, skt, head, (sock) => {
        this.wss.emit('connection', sock, req);
      });
    });
  }

  /**
   * Handle new connection: assign id and initialize token list
   *
   * @param {Socket} socket
   * @memberof WebsocketConnection
   */
  _onSocketConnection(socket, user_id) {

    let lastPing = Date.now();

    const interval = setInterval(() => {
      const timeSincePing = Date.now() - lastPing;

      if (timeSincePing > 30000) {
        console.log(`killing ws after ${timeSincePing}ms for`, user_id);
        socket?.terminate();

        return;
      }
      socket.send('pong');
    }, 5000 + 1000);

    socket.on('message', msg => {
      if(msg === '"ping"' || msg === 'ping') {
        console.log('in', 'ping');
        lastPing = Date.now();

        return;
      }
      this._onMessage(msg, socket, user_id);
    });

    socket.on('error', e => console.log('websocket error onError', e));
    socket.on('close', e => {
      clearInterval(interval);
      // delete from ws_User
      if (user_id in this.ws_User) {
        console.log(`Removing Websocket for user ${user_id} Reason`, e);
        delete this.ws_User[user_id];
      }
      for (const value of this.room.values()) {
        if(value?.users.get(user_id)?.current_room_id) {
          const r_id = value.users.get(user_id)?.current_room_id;
          const u = value.users.get(user_id);
          const rm = this.room.get(r_id);

          for (const [k, v] of rm.users) {
            if(value.created_by_id === user_id) {

              /*
               * deleteUsersInRoom(r_id);
               * const r_info = this.getActiveRoomInfo(r_id);
               * v?.client?.ws_User[k]?.ws.send(this.encodeMsg({
               *   act: 'onNewRoomData',
               *   dt: {...r_info},
               * }));
               */
            }else {
              console.log('listner leaving room');

              /*
               * leaveRoom(r_id, u?.joined_at);
               * rm?.users?.remove(u);
               */
            }
          }
        }
      }
    });
  }

  async _onMessage(message, ws, user_id) {
    let msg;

    if (message) {
      try {
        msg = JSON.parse(message);
      } catch (err) {
        debug('Json parser error', err);
      }
    }
    const { dt: data, act, ref_id } = msg;

    if (msg && act) {
      switch (act) {
        case 'create_room': {
          const dt = {
            act,
            dt: { room_id: uuidV4() },
            user_id: data.user_id,
          };
          const { dataValues } = await getCurrentUser(data?.user_id);
          const lofi = await Lofi.createRoom(this.worker_routers, dt.dt.room_id);

          const data_to_save = {
            room_id: dt.dt.room_id,
            about_room: data?.description,
            isPublic: data?.isPrivate,
            created_by_id: user_id,
            room_name: data?.name,
            muted_speakers_obj: {},
            block_speakers_obj: {},
          };
          const { created_at } = await _creatRoom(
            ...Object.values(data_to_save)
          );
          const newRoom = new Activerooms({
            ...data_to_save,
            user_id,
            created_at,
            speakers: new Set(),
            roomMessages: new Map().set(data_to_save?.room_id, []),
            lf: lofi,
          });

          this.room.add(newRoom);
          const room_id = data_to_save?.room_id;
          const room = this.room.get(room_id);
          const user = room.users.add(
            new UsersInRoom(dataValues, room)
          );
          const speakers = room?.speakers?.add(user?.id);

          room.raiseHandActive = true;
          const user_to_save = {
            room_id,
            user_id: user_id || user.id,
            user_name: user.user_name,
            photo_url: user.photo_url,
            room_permisions: {
              requested_to_speak: false,
              isSpeaker: true,
              isMod: true,
            },
          };


          user.room_permisions.isSpeaker = true;
          user.room_permisions.isMod = true;
          user.current_room_id = room_id;

          /** send the room creater a message */
          await this.sendWsMsg(user_id, this.encodeMsg({
            act: 'create_room_done',
            dt: { room_id: data_to_save.room_id, user_id },
          }));

          /*
           * send a push notification to all my followers
           * get their fcm ids from database
           */

          // const filteredNotifIds = notifIds.map((v, i) => v?.u_followed?.notification_id).filter(x => Boolean(x));

          /*
           * const msg = createMessage({
           *   title: "👋, Your Buddy has created a room can join to listen❔",
           *   icon: "ic_launcher",
           *   body: `${room?.about_room}`
           * });
           */

          /*
           * msg.addData({
           *   click_action: `budyclub://room/${room_id}`,
           *   imgUrl: `https://graph.facebook.com/${dataValues?.FB_id}/picture?type=large`,
           *   room_id: `${room_id}`,
           *   type: 'push',
           * });
           */

          // sendPushNotif(msg, filteredNotifIds);

          room?.lf.audioLevelObserver.on('volumes', (volumes) => {
            const { producer: { appData }, volume } = volumes[0];

            console.log('AudioLevel Observer [volume:"%s"]', volume, appData);

            /** signal active speaker to all peers in the room*/
            for (const [k, _] of room.users) {
              if(k in this.ws_User) {
                this.sendWsMsg(k, this.encodeMsg({
                  act: `onactivespeaker-${room_id}`,
                  dt: { user_id: appData.peer_id, room_id, volume },
                }));
              }
            }
          });

          room?.lf.audioLevelObserver.on('silence', (silence) => {
            console.log('on silence [silence:"%s"]', silence);
          });

          /** Get all the rooms and broadcast them*/
          this.getAllActiveRooms();

          const resp = await _joinRoom(...Object.values(user_to_save));

          user.joined_at = resp.created_at;
          await updateUserRoomPermisons(true, room_id, user.joined_at, 'isSpeaker');
          await updateUserRoomPermisons(true, room_id, user.joined_at, 'isMod');
          break;
        }

        case 'join_room_and_get_info': {
          const isRoom = this.room.has(data?.room_id);
          const { dataValues } = await getCurrentUser(data?.user_id);

          if(isRoom) {
            const room = this.room.get(data?.room_id);
            const roomMessages = room.roomMessages.get(data?.room_id);
            const isUser = room?.users.has(data?.user_id);

            if(isUser) {
              const user = room?.users.get(data?.user_id);

              /** check if user is a mod in the room */
              const isMod = user_id === room?.created_by_id && user.room_permisions?.isSpeaker;

              if(isMod) {
                let _resp;
                // join as speaker

                try {
                  _resp = await this.joinRoom(true, { room_id: room.id, user_id });
                } catch (error) {
                  console.log(error);
                }
                console.log(`${act}.........`, _resp);

                await _addMuteMap(data.room_id, user_id, true, room?.created_at);
              }
            } else {
              if(user_id in this.ws_User) {
                await this.sendWsMsg(user_id, this.encodeMsg({
                  act: 'updateRoomMessages',
                  dt: roomMessages.reverse(),
                }));
              }

              const user = room?.users.add(
                new UsersInRoom(dataValues, room),
              );

              // current room_id a user is in
              user.current_room_id = data?.room_id;

              const user_to_save = {
                room_id: data.room_id,
                user_id: user_id || user.id,
                user_name: user?.user_name,
                photo_url: user?.photo_url,
                room_permisions: {
                  requested_to_speak: false,
                  isSpeaker: false,
                  isMod: false,
                },
              };

              // join as listener
              await this.joinRoom(false, data);

              const resp = await _joinRoom(...Object.values(user_to_save));

              user.joined_at = resp.created_at;

              console.log(`${act}.........`, data);
            }

            /** get the new room information */
            const r_info = this.getActiveRoomInfo(data?.room_id);

            for (const [k, v] of room.users) {
              if (k in this.ws_User) {
                this.ws_User[k].ws.send(this.encodeMsg({
                  act: 'onNewRoomData',
                  dt: { ...r_info },
                }));
              }
            }
          }else{
            await deleteUsersInRoom(data?.room_id);
            await deleteRoom(data?.room_id);
          }
          break;
        }
        case 'request_to_speak': {
          const isRoom = this.room.has(data?.room_id);

          if(isRoom) {
            const room = this.room.get(data?.room_id);
            // check whether the room has max of 5 speakers
            const speakers = room?.speakers;

            /*
             * if(speakers.size > 5) {
             *   this.ws_User[data?.user_id].ws.send(JSON.stringify({
             *     act: "SpeakerListFull",
             *     dt: { c: '000' },
             *   }));
             */

            /*
             *   return;
             * }
             */

            if (!room?.raiseHandActive) {
              this.sendWsMsg(data?.user_id, this.encodeMsg({
                act: 'onCantReqToSpeak',
                dt: {
                  msg: 'Request to speak is Disabled.'
                }
              }));

              return;
            }

            const { dataValues } = await getCurrentUser(user_id);

            // get mods id or room owner id;

            const { created_by_id } = room;
            const _user = room.users.get(data?.user_id);

            _user.room_permisions.requested_to_speak = true;

            /*
             * send mod or current room owner list of pple who want to speak,
             * the mod or current room owner must be online.
             */
            const { user_name, photo_url, num_follower, bio, FB_id } = dataValues;

            await updateUserRoomPermisons(true, data?.room_id, _user.joined_at, 'requested_to_speak');

            // const requests = room?.requests;

            /*
             * if(requests.has(data?.user_id)) {
             *   return;
             * }
             */

            // requests.set(data?.user_id, { ...data, user_name, photo_url, num_follower, bio, FB_id });

            if(created_by_id in this.ws_User) {
              this.sendWsMsg(created_by_id, this.encodeMsg({
                act: 'onRequest',
                dt: { ...data, user: { user_name, photo_url, num_follower, bio, FB_id } },
              }));
            }
          }
          break;
        }
        case 'add_speaker': {
          const isRoom = this.room.has(data?.room_id);

          if(isRoom) {
            const room = this.room.get(data?.room_id);
            const user = room.users.get(data?.user_id);

            room?.speakers?.add(user?.id);
            user.room_permisions.isSpeaker = true;
            room.muted_speakers_obj[data?.user_id] = true;
            user.current_room_id = data?.room_id;
            await updateUserRoomPermisons(true, data?.room_id, user.joined_at, 'isSpeaker');
            await _addMuteMap(data?.room_id, data?.user_id, false, room?.created_at);


            const resp = await room.lf.add_speaker({
              room_id: data?.room_id,
              peer_id: data?.user_id
            });

            const msg = this.encodeMsg({
              act: "on_added_as_speaker",
              dt: {
                ...resp,
                room_id: data?.room_id,
              },
              user_id: data?.user_id,
            });

            await this.sendWsMsg(data?.user_id, msg);

            /** get the new room information */
            const r_info = this.getActiveRoomInfo(data?.room_id);

            for (const [k, v] of room.users) {
              if (k in this.ws_User) {
                this.ws_User[k]?.ws.send(this.encodeMsg({
                  act: 'onNewRoomData',
                  dt: { ...r_info },
                }));
              }
            }
          }
          break;
        }
        case 'leave_room': {
          const isRoom = this.room.has(data?.room_id);

          if(!isRoom) {
            await deleteUsersInRoom(`${data?.room_id}`);

            return;
          }
          if(isRoom) {
            const room = this.room.get(data?.room_id);
            const user = room.users.get(data?.user_id);

            if(user_id === room?.created_by_id) {
              try {
                await room?.lf.destroy_room(data?.room_id, data?.id);
                this.room.delete(data.room_id);
                await deleteRoom(data?.room_id);
                await deleteUsersInRoom(`${data?.room_id}`);
              } catch (err) {
                debug(err);
              }
            }else if(user) {
              await room?.lf.leave_room(data.room_id, user_id);
              room.users.remove(user);
              await leaveRoom(data?.room_id, user?.joined_at);
            }
          }
          break;
        }

        case 'speaking_change': {
          const isRoom = this.room.has(data?.room_id);

          if (isRoom) {
            const room = this.room.get(data?.room_id);

            room.active_speakers_obj[data?.user_id] = data.v;
            await setActiveSpeaker(data?.room_id, room?.created_at, data?.v, data?.user_id);

            /** Broadcast room changes */
            const r_info = this.getActiveRoomInfo(data?.room_id);

            for (const [k, v] of room.users) {
              if (k in this.ws_User) {
                this.ws_User[k].ws.send(this.encodeMsg({
                  act: 'onNewRoomData',
                  dt: { ...r_info },
                }));
              }
            }
          }
          break;
        }

        /**
         * set mute
         */
        case 'mute': {
          const { isMuted, room_id, user_id } = data;
          const isRoom = this.room.has(room_id);

          if(isRoom) {
            const room = this.room.get(room_id);

            room.muted_speakers_obj[user_id] = isMuted;
            await _setMuteMap(room_id, room?.created_at, isMuted, user_id);

            /** Broadcast room changes */
            const r_info = this.getActiveRoomInfo(room_id);

            for (const [k, v] of room.users) {
              if (k in this.ws_User) {
                this.ws_User[k].ws.send(this.encodeMsg({
                  act: 'onNewRoomData',
                  dt: { ...r_info },
                }));
              }
            }
          }
          break;
        }

        /**
         * Remove speaker #set user as listener
         */

        case 'remove_speaker': {
          const isRoom = this.room.has(data?.room_id);

          if(isRoom) {
            const room = this.room.get(data?.room_id);

            const resp = await room?.lf.remove_speaker({ room_id: data?.room_id, peer_id: data?.user_id });

            console.log(resp);
          }
          break;
        }

        case 'destroy_room': {

          /**
           * Delete the room from the store
           */
          const isRoom = this.room.has(data?.room_id);

          if(isRoom) {
            const room = this.room.get(data?.room_id);

            await room?.lf.destroy_room(room?.room_id, data?.user_id);
            this.room.delete(data.room_id);
            await deleteRoom(data?.room_id);
            await deleteUsersInRoom(data?.room_id);
          }
          this.getAllActiveRooms();
          break;
        }
        case 'get_user_profile': {
          const { dataValues } = await getCurrentUser(data);

          if(user_id in this.ws_User) {
            await this.sendWsMsg(user_id, this.encodeMsg({
              act: 'get_user_profile_done',
              dt: { ...dataValues },
              ref_id,
            }));
          }
          break;
        }
        case 'get_rooms_list': {
          this.getAllActiveRooms(ref_id);
          break;
        }
        case 'room_chat_message': {
          break;
        }
        case 'follow_unfollow': {
          const _response = await insertFollows(data?.id_followed, data?.id_following, data?.action);

          if(user_id in this.ws_User) {
            await this.sendWsMsg(user_id, this.encodeMsg({
              act: 'follow_unfollow_done',
              dt: _response,
            }));
          }
          break;
        }
        case 'update_user_profile': {
          const _response = await updateUserProfile(data, user_id);

          if(user_id in this.ws_User) {
            await this.sendWsMsg(user_id, this.encodeMsg({
              act: 'update_user_profile_done',
              dt: _response,
            }));
          }
          break;
        }
        case 'set_chat': {
          if(this.room.has(data?.room_id)) {
            const room = this.room.get(data?.room_id);

            await this.sendWsMsg(user_id, this.encodeMsg({
              act: 'set_chat_done',
              dt: data?.v,
            }));
          }
          break;
        }
        case 'send_chat_msg': {
          if(this.room.has(data?.room_id)) {
            // get the room from database
            const { dataValues } = await getCurrentUser(user_id);

            const room = this.room.get(data?.room_id);

            const { user_name, FB_id } = dataValues;

            const msgData = { _id: data?._id,
              ...data?.message,
              user: {
                _id: data?.user_id,
                name: user_name,
                avatar: `https://graph.facebook.com/${FB_id}/picture?type=large`,
              }, };

            if(room.roomMessages.has(data?.room_id)) {
              const msg = room.roomMessages.get(data?.room_id)?.push(msgData);
              // console.log(room.roomMessages.get(data?.room_id));
            }

            for (const [k, v] of room.users) {
              if(k in this.ws_User && this.ws_User[k].ws.OPEN) {
                this.ws_User[k].ws.send(this.encodeMsg({
                  act: `new_chat_msg_${data?.room_id}`,
                  dt: msgData,
                }));
              }
            }
          }
          break;
        }
        case 'set_raised_hand': {
          if(this.room.has(data?.room_id)) {
            const room = this.room.get(data?.room_id);

            // console.log("Before", room.raiseHandActive);
            room.raiseHandActive = data?.v;
            // console.log("After", room.raiseHandActive);
            await this.sendWsMsg(user_id, this.encodeMsg({
              act: 'set_raised_hand_done',
              dt: data?.v,
            }));
          }
          break;
        }
        case 'reconnect_to_lofi': {
          if(this.room.has(data?.room_id)) {
            const room = this.room.get(data?.room_id);
            const user = room?.users.get(data?.user_id);

            /** check if user is a mod in the room */
            // const isMod = user_id === room?.created_by_id && user.room_permisions?.isSpeaker;
            const resp = await this.joinRoom(user_id === room?.created_by_id, data);

            await this.sendWsMsg(user_id, this.encodeMsg({
              act: 'reconnect_to_lofi_done',
              dt: { resp },
            }));
          }
          break;
        }
        default:
          if (act in ACTION_CODE_FUNCTION && act.startsWith('@')) {

            /**
             * check if room exist
             */
            const isRoom = this.room.has(data?.room_id);

            if(!isRoom) return;
            const room = this.room.get(data?.room_id);

            ACTION_CODE_FUNCTION[act](act, data, this.ws_User, room?.lf);
          }
          break;
      }
    }
    if (msg && act && act in AUTH_FUNCTION) {
      const msg = this.encodeMsg({
        act: 'we_are_good_to_go',
        user_id,
        onlineCount: this.onlineCount
      });

      await this.sendWsMsg(user_id, msg);
    }
  }

  getAllActiveRooms() {
    const s_rooms = [];

    for (const [k, v] of this.room) {
      const r = {
        room_id: k,
        created_by_id: v?.created_by_id,
        room_name: v?.room_name,
        about_room: v?.about_room,
        isPublic: v?.isPublic,
        users: (() => {
          const u = [];

          for (const [_, e] of v.users) {
            const user = {
              user_name: e?.user_name,
              full_name: e?.full_name,
              photo_url: e?.photo_url,
              FB_id: e?.FB_id,
              current_room_id: e?.current_room_id,
              room_permisions: e?.room_permisions,
            };

            u.push(user);
          }

          return u;
        })(),
      };

      s_rooms.push(r);
    }
    Object.keys(this.ws_User).forEach((i, _) => {
      this.sendWsMsg(i, this.encodeMsg({
        act: 'new_room_created_done',
        dt: [...s_rooms]
      }));
    });

    return s_rooms;
  }

  get onlineCount() {
    return Object.keys(this.ws_User).length;
  }

  getRoom(id) {
    if(this.room.has(id)) {
      return this.room.get(id);
    }else{
      return null;
    }
  }

  /**
   * Get The Room info by room_id
   * @param {String} room_id
   * @returns Data
   */
  getActiveRoomInfo(room_id) {
    const room = this.getActiveRoom(room_id);

    if(Object.entries(room).length === 0) return {};

    return {
      room_id: room?.id,
      created_by_id: room?.created_by_id,
      room_name: room?.room_name,
      about_room: room?.about_room,
      isPublic: room?.isPublic,
      created_at: room?.created_at,
      active_speakers_obj: room?.active_speakers_obj,
      muted_speakers_obj: room?.muted_speakers_obj,
      block_speakers_obj: room?.block_speakers_obj,
      requests: room?.requests,
      room_users: (() => {
        const u = [];

        for (const [i, e] of room.users) {
          const ex_d = {
            user_id: i,
            user_name: e?.user_name,
            full_name: e?.full_name,
            email: e?.email,
            photo_url: e?.photo_url,
            FB_id: e?.FB_id,
            background_photo_url: e?.backgroud_photo_url,
            last_online: e?.last_online,
            current_room_id: e?.current_room_id,
            room_permisions: e?.room_permisions,
          };

          u.push(ex_d);
        }

        return(u);
      })(),
    };
  }

  /**
   *
   * @param {string} room_id the id of the room
   * @returns {Object} Object
   */
  getActiveRoom(room_id) {
    if(this.room.has(room_id)) {
      return this.room.get(room_id);
    }else {
      return {};
    }
  }

  async sendWsMsg(user_id, encodedMsg) {
    const ws = this.ws_User[user_id]?.ws;

    return new Promise((resolve, reject) => {
      ws?.send(encodedMsg, { compress: false, binary: false }, error => {
        if(error) {
          console.log(error);
          reject(error);
        }
        resolve();
      });
    });
  }

  encodeMsg(msg) {
    try {
      return JSON.stringify(msg, true);
    } catch (err) {
      return false;
    }
  }

  async _getUser(user_id) {
    const { dataValues } = await getCurrentUser(user_id);

    return dataValues;
  }

  async joinRoom(isSpeaker, data) {
    const room = this.getRoom(data.room_id);

    if(isSpeaker) {
      const resp = await room.lf?.join_as_speaker(data.room_id, data.user_id);
      const msg = this.encodeMsg({ act: 'you_joined_as_speaker', dt: { ...resp, user_id: data.user_id } });

      return await this.sendWsMsg(data?.user_id, msg);
    }

    if(!isSpeaker) {
      const resp = await room.lf?.join_room_as_listener({
        room_id: data?.room_id,
        peer_id: data?.user_id
      });

      const msg = this.encodeMsg({
        act: "joined_as_listener",
        dt: {
          room_id: data?.room_id,
          peer_id: data?.user_id,
          ...resp
        },
        user_id: data?.user_id
      });

      return await this.sendWsMsg(data?.user_id, msg);
    }
  }

  async startSfu() {
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

module.exports = WebsocketConnection;
