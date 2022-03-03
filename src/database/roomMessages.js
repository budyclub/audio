"use strict";

const db = require('../models');
const { Op, fn, col } = require('sequelize');

const { Room_Messages } = db;

/**
 *
 * @returns {Promise}
 */

async function createRoomMessage(data) {
  // return await db.Room.create()
  const room_msg = Room_Messages.build(data);

  console.log(room_msg instanceof Room_Messages);

  return await room_msg.save();
}

module.exports = {
  createRoomMessage
}
