/* eslint-disable eqeqeq */
/* eslint-disable no-eq-null */
/* eslint-disable no-undef */
const fcm = require('node-gcm');

// initialize GCM/FCM with the GCM_FCM_KEY

const sender = new fcm.Sender(process.env.GCM_FCM_KEY);

const message = new fcm.Message();

// create a message to send
function createMessage(msgData) {
  return new fcm.Message(
    // this works when the app is killed, and you can still get the above data object from
    {
      contentAvailable: true,
      delayWhileIdle: true,
      notification: {
        ...msgData,
      },
      timeToLive: 4,
      priority: "high",
      restrictedPackageName: 'com.budyclub.app',
    }
  )
}


function sendPushNotif(msg, registrationTokens) {
  sender.send(msg, { registrationTokens }, 10, (_err, { results }) => {

    const failed_tokens = registrationTokens.filter((token, i) => results[i]?.error != null);

    console.log('These tokens are no longer ok:', failed_tokens?.length);
  })
}

module.exports = {
  sendPushNotif,
  createMessage,
}
