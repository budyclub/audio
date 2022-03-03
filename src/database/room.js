"use strict";

const db = require('../models');
const { Op, fn, col } = require('sequelize');

const { Room, Peer, Buddy_Club_User, Room_Messages } = db;


// const Peers = Room.hasMany(Peer,{
//   as: 'peers',
//   foreignKey: 'room_id',
// });

/**
 *
 * @returns {Promise}
 */

async function createRoom(room, peer) {
  return await Room.create({
    ...room,
    peers: peer,
  }, {
    include: [
      {
        model: Peer,
        as: 'peers'
      }
    ]
  });
}

async function getAllRooms(limit, offset) {
  return await Room.findAll({
    where: {
      is_public: {
        [Op.not]: true,
      }
    },
    attributes: ['room_id', 'about_room', 'room_name', 'is_public', 'created_by_id', 'muted_speakers_obj'],
    include: [
      {
        model: Peer,
        as: 'peers',
        attributes: { exclude: ['updatedAt', 'peer_id', 'user_id'] },
        include: [
          {
            model: Buddy_Club_User,
            as: 'user',
            required: true,
            attributes: ['photo_url', 'FB_id']
          }
        ]
      },
      {
        model: Buddy_Club_User,
        as: 'room_creator',
        required: true,
        attributes: ['photo_url', 'user_id', 'FB_id']
      }
    ],
    limit,
    offset,
  })
}

async function getRoom(room_id) {
  return await Room.findOne({
    where: {
      room_id: {
        [Op.eq]: room_id,
      }
    },
    include: [
      {
        model: Peer,
        as: 'peers',
        attributes: { exclude: ['updatedAt', 'peer_id', 'createdAt'] },
        include: [
          {
            model: Buddy_Club_User,
            as: 'user',
            attributes: [
              'user_id',
              'user_name',
              'photo_url',
              'FB_id',
              'current_room_id',
              'full_name',
              'num_follower',
              'num_following',
              'bio',
            ]
          }
        ]
      },
      {
        model: Buddy_Club_User,
        as: 'room_creator',
        attributes: ['photo_url', 'user_id', 'FB_id']
      },
      {
        model: Room_Messages,
        require: true,
        as: 'room_messages',
        attributes: { exclude: ['message_id', 'updatedAt'] },
        include: [
          {
            model: Buddy_Club_User,
            as: 'peer_messages',
            attributes: ['photo_url', 'user_id', 'FB_id', 'user_name', 'online', 'last_online']
          }
        ]
      }
    ],
    // raw: true,
  })
}

async function getRoomCreator(room_id) {
  return await Room.findByPk(room_id, { attributes: ['created_by_id'] })
}

async function updateRoom() {

}

async function removeRoom(room_id) {
  try {
    return await Room.destroy({
      where: {
        room_id: {
          [Op.eq]: room_id
        }
      }
    });
  } catch (err) {
    console.log(err);
  }
}

module.exports = {
  createRoom,
  getAllRooms,
  getRoom,
  updateRoom,
  removeRoom,
  getRoomCreator,
}
