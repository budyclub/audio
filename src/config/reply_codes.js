
module.exports = {
  rep_code: {
    "@send_track_send_done": (act, dt, user_id, _, ws) => {
      console.log(`${act}.........`, dt);
      ws?.send(JSON.stringify({
        act,
        dt: { ...dt, user_id }
      }));
    },
    "@connect_transport_send_done": (act, dt, user_id, _, ws) => {
      console.log(`${act}.........`, dt);
      ws?.send(JSON.stringify({
        act,
        dt: { ...dt, user_id }
      }));
    },

    "@recv_tracks_done": (act, dt, user_id, _, ws) => {
      console.log(`${act}.........`, dt);
      ws?.send(JSON.stringify({
        act: "@recv_tracks_done",
        dt: { ...dt, user_id }
      }));
    },
    "@connect_transport_recv_done": (act, dt, user_id, _, ws) => {
      console.log(`${act}.........`, dt);
      ws?.send(JSON.stringify({
        act,
        dt: { ...dt, user_id }
      }));
    },
    "@ice_restart_done": (act, dt, user_id, _, ws) => {
      console.log(`${act}.........`, dt);
      ws?.send(JSON.stringify({
        act,
        dt: { ...dt, user_id }
      }));
    }
  }
};
