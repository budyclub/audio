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
    const { user_name, email } = d;
    const user_id = v4();

    if(d?.providerId === 'facebook.com') {
      // check whether user already exist in the database
      let existing_user;

      try {
        existing_user = await db.Buddy_Club_User.findOne({
          where: {
            FB_id: {
              [Op.eq]: d?.FB_id,
            }
          }
        });
      } catch (err) {
        res.json({
          access_token: null,
          code: 4,
          err
        });
      }

      if (existing_user) {
        req.session.user_data = existing_user.dataValues;
        res.json({
          access_token: auThToken({ data: existing_user.dataValues }),
          new_user: false,
          code: 0,
        });
      } else {
        try {
          const [dataValues] = await db.Buddy_Club_User.findOrCreate({
            where: { user_name, email },
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
    }
  });
}

router.post('/u', async (req, res) => {
  const d = req.body;

  if(d?.providerId === 'facebook.com') {
    // check whether user already exist in the database
    try {
      const u = await db.Buddy_Club_User.findOne({
        where: {
          FB_id: {
            [Op.eq]: d.FB_id,
          }
        }
      });

      if (u.dataValues.user_id) {
        req.session.user_data = u.dataValues;
        res.json({
          access_token: auThToken({ data: u.dataValues }),
          code: 0,
        });
      }else{
        res.json({
          access_token: null,
          code: 1,
        });
      }
    } catch (err) {
      res.json({
        access_token: null,
        code: 4,
      });
    }
  }
})
module.exports = { login };
