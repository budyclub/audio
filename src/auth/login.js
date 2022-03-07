/* eslint-disable require-atomic-updates */
const express = require('express');
const { Op } = require('sequelize');
const { v4 } = require('uuid');
// eslint-disable-next-line new-cap
const router = express.Router();
const { auThToken } = require('../utils/auth/tokenAuth');
const db = require('../models');

function login() {
  return router.post('/login', async (req, res) => {
    const d = req.body;
    const { user_name, email, FB_id } = d;
    const user_id = v4();

    if(d?.providerId === 'facebook.com') {
      // check whether user already exist in the database
      try {
        const [dataValues] = await db.Buddy_Club_User.findOrCreate({
          where: { FB_id },
          defaults: { ...d, user_id }
        });

        req.session.user_data = dataValues;
        res.json({
          access_token: auThToken({ data: dataValues }),
          new_user: true,
          code: 0,
        });
      } catch (err) {
        res.json({
          access_token: null,
          code: 4,
          err,
        });
      }
    }
  });
}

router.post('/u', async (req, res) => {
  const d = req.body;

  let resp;

  if(d?.providerId === 'facebook.com') {
    // check whether user already exist in the database
    try {
      resp = await db.Buddy_Club_User.findOne({
        where: {
          FB_id: {
            [Op.eq]: d.FB_id,
          }
        }
      });
    } catch (err) {
      res.json({
        access_token: null,
        code: 4,
        error: err
      });
    }
  }

  if (!resp) {
    res.json({
      access_token: null,
      code: 1,
    });

    return;
  }
  req.session.user_data = resp.dataValues;
  res.json({
    access_token: auThToken({ data: resp.dataValues }),
    code: 0,
  });
})
module.exports = { login };
