const User = require('./Users');

/**
 * Represent user currently in the room
 */
class UsersInRoom extends User {

  /**
   * The voice state of a user
   * @typedef {Object} VoiceState
   * @property {boolean} deafened Whether the user is deafened
   * @property {boolean} muted Whether the user is muted
   * @property {boolean} speaking Whether the user is currently speaking
   */

  /**
   * The permissions of a user in a room
   * @typedef {Object} room_permisions
   * @param {boolean} isSpeaker Whether the user has been added as a speaker
   * @param {boolean} askedToSpeak Whether the user has asked to speak
   * @param {boolean} isMod Whether the user is a moderator
   */

  /**
   * @param {Object} data The data for the user
   * @param {ActiveRoom} r The room the user belongs to
   * @param {Moonstone} c The client that controls this user
   */
  constructor(data, r, c) {
    super(data, c);
    this.client = c;

    /**
     * The room this user object belongs to
     * @type {ActiveRoom}
     */
    this._room = r;

    /**
     * The voice state of the user
     * @type {VoiceState}
     */
    this.voiceState = { deafened: false, muted: false, speaking: false };

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
  async setAsListener() {
    await this.client.setRole("listener", this);
  }

  /**
   * Sets the user's role as speaker
   * @return {Promise}
   */
  async setAsSpeaker() {
    await this.client.setRole("speaker", this);
  }

  get isRoomCreater() {
    return this.user_id === this._room.created_by_id;
  }

  get isSpeaker() {
    return this.isRoomCreater || this.isSpeaker;
  }
}

module.exports = UsersInRoom;
