/**
 * Represents a room
 * @prop {String} room_name The name of the room
 * @prop {string} about_room The description or about the room
 * @prop {Boolean} isPublic Whether the room is public
 * @prop {String} created_by_id User that created the room
 * @prop {Date} created_at The date that room was celebrated
 * @prop {String} room_id The id of the room
 * @prop {Array[users]} room_users All the peope who have joined the room.
 */

class Room {
  constructor(data) {
    this.id = data.room_id;
    this.created_by_id = data.user_id;
    this.updateRoomData(data)
  }


  /**
   *
   * @param {Object} d
   */
  updateRoomData(d) {
    this.id = d.room_id;
    if(d.room_name !== undefined) this.room_name = d.room_name;
    if(d.about_room !== undefined) this.about_room = d.about_room;
    if(d.isPublic !== undefined) this.isPublic = d.isPublic;
    if(d.created_at !== undefined) this.created_at = d.created_at;
    this.created_by_id = d?.user_id;
    this.active_speakers_obj = d?.active_speakers_obj || {};
    this.muted_speakers_obj = d?.muted_speakers_obj || {};
    this.block_speakers_obj = d?.block_speakers_obj || {};
    this.requesting_to_speak = d?.requesting_to_speak || {};
    this.speakers = d?.speakers;
    this.requests = new Map();
    this.roomMessages = d?.roomMessages;
    this.lf = d?.lf;
    this.raiseHandActive = d?.raiseHandActive;
  }
}

module.exports = Room;
