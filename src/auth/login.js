/* eslint-disable require-atomic-updates */
const express = require('express');
const { Op } = require('sequelize');
const { v4 } = require('uuid');
// eslint-disable-next-line new-cap
const router = express.Router();
const { auThToken } = require('../utils/auth/tokenAuth');
const db = require('../models');

router.post('/auth', async (req, res) => {
  const d = req.body;
  const { user_name, email } = d;
  const user_id = v4();

  if(d?.providerId === 'facebook.com') {
    // check whether user already exist in the database
    try {
      const u = await db.Buddy_Club_User.findOne({
        where: {
          FB_id: {
            [Op.eq]: d?.FB_id,
          }
        }
      });

      if (u?.dataValues?.user_id) {
        req.session.user_id = u?.dataValues?.user_id;
        res.json({
          access_token: auThToken({ data: u?.dataValues?.user_id }),
          code: 0,
        });
      } else {
        try {
          const resp_data = await db.Buddy_Club_User.findOrCreate({
            where: { user_name, email },
            defaults: { ...d, user_id }
          });

          const data = resp_data[0].dataValues.user_id;

          req.session.user_id = user_id;
          res.json({
            access_token: auThToken({ data }),
            code: 0,
          });
        } catch (err) {
          res.json({
            access_token: null,
            code: 4,
          });
        }
      }
    } catch (err) {
      res.json({
        access_token: null,
        code: 4,
      });
    }
  }
});

router.post('/u', async (req, res) => {
  const d = req.body;

  if(d?.providerId === 'facebook.com') {
    // check whether user already exist in the database
    try {
      const u = await db.Buddy_Club_User.findOne({
        where: {
          FB_id: {
            [Op.eq]: d?.FB_id,
          }
        }
      });

      if (u?.dataValues?.user_id) {
        req.session.user_id = u?.dataValues?.user_id;
        res.json({
          access_token: auThToken({ data: u?.dataValues?.user_id }),
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
module.exports = router;
