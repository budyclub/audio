const { sendPushNotif, createMessage } = require("../../../node-gcm/push-notification");

const _sendPushNotif = async ({ data: { p, fcmIds } }) => {
  const msg = createMessage({ ...p.notif });

  msg.addData({ ...p.data });

  return sendPushNotif(msg, fcmIds);
}

module.exports = {
  _sendPushNotif
}
