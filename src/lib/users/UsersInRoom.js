const User = require('./Users');

/**
 * Represent user currently in the room
 */
class UsersInRoom extends User {

  constructor(data, r) {
    super(data);

    /**
     * The room this user object belongs to
     * @type {ActiveRoom}
     */
    this._room = r;
    /**
    * The permissions the user has in the room
    * @type RoomPpermisions
    */
    this.room_permisions = {};


    this.update(data);
  }

  update(d) {
    super.updateUser(d);
    if (d.room_permisions !== undefined && d.room_permisions !== null) this.room_permisions = d.room_permisions;
  }

  /**
   * Sets the user's role as listener
   * @return {Promise}
   */
  // async setAsListener() {
  //   await this.client.setRole("listener", this);
  // }

  /**
   * Sets the user's role as speaker
   * @return {Promise}
   */
  // async setAsSpeaker() {
  //   await this.client.setRole("speaker", this);
  // }

  // get isRoomCreater() {
  //   return this.user_id === this._room.created_by_id;
  // }

  // get isSpeaker() {
  //   return this.isRoomCreater || this.isSpeaker;
  // }
}

module.exports = UsersInRoom;
