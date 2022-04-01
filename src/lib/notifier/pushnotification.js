const { getNotificationIds } = require("../../database/user");
const { JobQueue } = require("../jobs/jobqueue");
const CreatePushNotificationMessage = require("./createNotification");

class PushNotification extends CreatePushNotificationMessage {

  constructor(obj) {
    super(obj);
  }

  async sendPushOnNewRoomCreation() {
    const fcmIds = await getNotificationIds(this.obj.created_by_id);

    this.sendPushNotification(fcmIds);
  }

  notify(fcmIds) {
    JobQueue.Instance.createJob({ key: 'push-notifications', p: { p: this.pushMessage, fcmIds } });
  }

  sendPushNotification(fcmIds = []) {
    const filteredFcmdIds = fcmIds.map((v, i) => v.u_following.notification_id).filter(x => Boolean(x));

    this.notify(filteredFcmdIds);
  }

  get pushMessage() {
    return this._createMessage();
  }

}

module.exports = PushNotification;
