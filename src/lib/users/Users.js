const Db = require('./Db');

/**
 * Represents a user
 * @param {String} user_id The user id
 * @param {String} displayName the name of the user
 * @param {String} photo_url the link of user photo
 * @param {String} background_photo_url background banner
 * @param {Date} last_online last online
 * @param {String} current_room_id the current room user is in
 * @param {Boolean} requested_to_speak whether the user has requested to speak
 * @param {Boolean} isMod whether the user is a moderater
 * @param {Boolean} isSpeaker whether the user is a speaker in the room
 */

class Users {

  /**
   *
   * @param {Object} data
   */

  constructor(data = {}) {
    this.id = data.user_id || data.id;
    this.FB_id = data?.FB_id;
    this.user_name = data?.user_name;
    this.full_name = data?.full_name;
    this.email = data?.email;
    this.photo_url = data?.photo_url;
    this.background_photo_url = data?.backgroud_photo_url;
    this.last_online = data?.last_online;
    this.current_room_id = data?.current_room_id;
    this.room_permisions = data?.room_permisions || {};
    this.joined_at = null;
    this.num_following = data?.num_following;
    this.num_follower = data?.num_follower;
    this.updateUser(data)
  }

  updateUser(d) {
    this.id = d.user_id || d.id;
    this.FB_id = d?.FB_id;
    this.user_name = d?.user_name;
    this.full_name = d?.full_name;
    this.email = d?.email;
    this.photo_url = d?.photo_url;
    this.background_photo_url = d?.backgroud_photo_url;
    this.last_online = d?.last_online;
    this.current_room_id = d?.current_room_id;
    this.joined_at = d?.joined_at;
    this.num_following = d?.num_following;
    this.num_follower = d?.num_follower;
    this.room_permisions = d?.room_permisions || {};
  }
}

module.exports = Users;
