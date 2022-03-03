const router = require('express').Router();

const {
  user,
  insertFollows,
  getUser,
  getFollowFollowers,
  updateNotifiactionId,
  getNotificationIds,
} = require('../../../database/user');

// const { createMessage, sendPushNotif } = require('../../../node-gcm/push-notification');
const { getAllRooms: _getAllrooms, getRoom: _getRoom } = require('../../../database/room');
const { _updatePeerRoomPermisions, _updatePeerSpeaker } = require('../../../database/roomPeers');

const routes = {
  rooms() {
    return router.get('/rooms/lim/:limit/offs/:offset', async (req, res) => {
      // const rooms = await getAllRooms();
      const { limit, offset } = req.params;

      try {
        // const data = JSON.parse(rooms, true);

        const rooms = await _getAllrooms(limit, offset);

        if(rooms.length > 0 && rooms) {
          res.json(rooms);
        }
        // res.json(data);
      } catch (err) {
        errLog(err);
      }
    });
  },

  u() {
    return router.get('/:id', async (req, res) => {
      // get the user by user name, uuid or email
      const { id } = req.params;

      const resp = await getUser(id);

      console.log('following', resp?.dataValues?.following?.length);
      console.log('followers', resp?.dataValues?.follower?.length);

      res.json(resp?.dataValues ?? {});
    });
  },

  ff() {
    return router.get('/followers-following/:id/:r', async (req, res) => {
      const { id, r } = req.params;
      const resp = await getFollowFollowers(id, r);

      res.json(resp);
    });
  },

  follow() {
    return router.post('/follow', async (req, res) => {
      const { id_followed, id_following, act } = req.body;

      const resp = await insertFollows(id_followed, id_following, act);

      res.json(resp);
    });
  },


  setNotification_id() {
    return router.put('/savedevicetoken/:user_id', async (req, res) => {
      const { user_id } = req.params;
      const { token } = req.body;

      const resp = await updateNotifiactionId(token, user_id);

      res.json(resp);
    });
  },

  updateRoomPermisions() {

    return router.put('/updateroompermision', async (req, res) => {
      const { room_id, peer_id, value } = req.body;

      const resp = await _updatePeerRoomPermisions(room_id, peer_id, !value).catch(err => console.log(err))

      res.json(resp);
    });
  },

  updatePeerSpeaker() {
    return router.put('/updatepeerspeaker', async (req, res) => {
      const { room_id, peer_id, value } = req.body;

      const resp = await _updatePeerSpeaker(room_id, peer_id, !value).catch(err => console.log(err));

      res.json(resp);
    })
  }
}

module.exports = routes;
