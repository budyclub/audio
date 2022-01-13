const fcm = require('firebase-admin');

const serviceAccount = require('../../budyclub-e8c2d-firebase-adminsdk-2kj7t-ca4d2c2fd6.json');

fcm.initializeApp({
  credential: fcm.credential.applicationDefault(),
  // credential: fcm.credential.cert(serviceAccount),
})

function sendPushNotif(t, message) {
  return fcm.messaging().sendToDevice(t, message, {
    // priority: 'HIGH',
    // contentAvailable: true,
    timeToLive: 604800,
  })
}

module.exports = {
  sendPushNotif,
}

