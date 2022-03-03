"use strict";

const db = require('../models');
const { Op, fn, col, QueryTypes } = require('sequelize');

const { Peer } = db;

/**
 *
 * @returns {Promise}
 */

async function createRoomPeer(data) {
  const { room_id, user_id } = data;


  return await Peer.findOrCreate({
    where: { room_id, user_id },
    defaults: data
  });
}

async function getRoomPeers(room_id) {
  const peer = await Peer.findAll({
    where: {
      room_id: {
        [Op.eq]: room_id
      }
    },
    attributes: ['user_id'],
    raw: true,
  });

  // db.sequelize.close().catch(err => console.log(err));

  return peer;
}

const _updatePeerRoomPermisions = async (room_id, user_id, value, _case) => {
  // jsonb_set (target jsonb, path text[], new_value jsonb [, create_if_missing boolean ]);

  switch (_case) {
    case 'isMod':
      return await db.sequelize.query(
        `UPDATE public."Peers" SET room_permisions = jsonb_set(room_permisions, '{isMod}', ':value', false) WHERE room_id= :room_id AND user_id= :user_id`, {
          replacements: { room_id, user_id, value },
          type: QueryTypes.UPDATE,
        });
    default:
      return await db.sequelize.query(
        `UPDATE public."Peers" SET room_permisions = jsonb_set(room_permisions, '{isSpeaker}', ':value', false) WHERE room_id= :room_id AND user_id= :user_id`, {
          replacements: { room_id, user_id, value },
          type: QueryTypes.UPDATE,
        });
  }
}

const _updatePeerSpeaker = async (room_id, peer_id, value, _case) => {

  switch (_case) {
    case 'active_speakers_obj':
      return await db.sequelize.query(
        `UPDATE public."Rooms" SET active_speakers_obj = jsonb_set(active_speakers_obj, :peer_id, ':value', true) WHERE room_id= :room_id`, {
          replacements: { room_id, value, peer_id: `{${peer_id}}` },
          type: QueryTypes.UPDATE,
        }
      );
    case 'muted_speakers_obj':
      return await db.sequelize.query(
        `UPDATE public."Rooms" SET muted_speakers_obj = jsonb_set(muted_speakers_obj, :peer_id, ':value', true) WHERE room_id= :room_id`, {
          replacements: { room_id, value: !value, peer_id: `{${peer_id}}` },
          type: QueryTypes.UPDATE,
        }
      );
    default:
      return await db.sequelize.query(
        `UPDATE public."Rooms" SET block_speakers_obj = jsonb_set(block_speakers_obj, :peer_id, ':value', true) WHERE room_id= :room_id`, {
          replacements: { room_id, value, peer_id: `{${peer_id}}` },
          type: QueryTypes.UPDATE,
        }
      );
  }
}

const deletePeer = async (user_id, room_id) => {
  return await Peer.destroy({
    where: {
      user_id: {
        [Op.eq]: user_id
      },
      room_id: {
        [Op.eq]: room_id
      }
    }
  });
}

module.exports = {
  createRoomPeer,
  getRoomPeers,
  _updatePeerRoomPermisions,
  _updatePeerSpeaker,
  deletePeer,
}
