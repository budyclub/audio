const Room = require('./Room');
const Collection = require('../../utils/collection/Collection');
const UsersInRoom = require('../users/UsersInRoom');

/**
 * Represents a room that you are connected to
 * @prop {Collection<UsersInRoom>} users The users who have joined the room
 * @prop {Boolean} autoSpeaker Whether you automatically become a speaker when you ask to speak
 * @prop {ActiveUser} selfUser The bot user
 */

class Activerooms extends Room {

  /**
   *
   * @param {*} data
   * @param {*} c client controlling the room
   */
  constructor(data) {
    super(data);

    this.users = new Collection(UsersInRoom);
    this.updateData(data);
  }

  updateData(data) {
    super.updateRoomData(data);
    // if (data.users !== undefined) {
    //   data.users.forEach((user) =>
    //     this.users.add(new UsersInRoom(user, this, this.client))
    //   );
    // }
    
  }
}

module.exports = Activerooms;
