module.exports = class CreatePushNotificationMessage {
  constructor(obj = {}) {
    this.obj = obj;
  }

  _createMessage() {

    const notif = {
      title: "Hi...👋, Your Buddy has created a room",
      icon: "ic_launcher",
      body: `${this.obj.about_room}`
    }

    const data = {
      click_action: `budyclub://room/${this.obj.room_id}`,
      imgUrl: `https://graph.facebook.com/${this.obj.FB_id}/picture?type=large`,
      room_id: this.obj.room_id,
      type: 'push',
    }

    return { notif, data };
  }
}
