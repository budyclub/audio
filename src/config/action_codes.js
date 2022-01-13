const { verifyToken } = require('../utils/auth/tokenAuth');
// const {v4: uuidV4} = require('uuid');

module.exports = {
  ACTION_CODE_FUNCTION: {

    "@connect_transport": async (act, data, ws, lofi) => {
      console.log(act, data);
      await lofi?.connect_transport({...data, peer_id: data.user_id}, data.user_id, ws);
    },
    "@send_track": async (act, data, ws, lofi) => {
      console.log(act, data);
      await lofi?.send_tracks({...data, peer_id: data.user_id}, data.user_id, ws);
    },
    "@recv_tracks": async (act, data, ws, lofi) => {
      console.log(act, data);
      await lofi?.recv_tracks({...data, peer_id: data.user_id}, data.user_id, ws);
    },
    "@restartIce": (act, { room_id, user_id, direction }, _, sendData) => {
      sendData({
        act,
        dt: {
          room_id,
          direction,
          peer_id: user_id
        },
        user_id,
      });
    },
  },
  AUTH_FUNCTION: {
    "auth_data": (dt, ws) => {
      const data = verifyToken(dt.accessToken);

      ws.send(JSON.stringify({ act: 'we_are_good_to_go', data }));
    },
  }
};
