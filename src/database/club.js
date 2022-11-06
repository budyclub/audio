"use strict";

const db = require('../models');
const { Op, fn, col } = require('sequelize');

const { Room, Peer, Buddy_Club_User, Clubs, Clubmembers } = db;

/**
 * create a club
 */

async function createClub(data) {
  return await Clubs.create({
    ...data
  }, {
    include: [
      {
        model: Clubmembers,
        as: 'm',
      }
    ]
  });
}

async function createClubMember(data) {
  return await Clubmembers.create({ ...data });
}

module.exports = {
  createClub,
  createClubMember
}
