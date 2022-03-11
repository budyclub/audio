/* eslint-disable no-case-declarations */

"use strict";

const db = require('../models');
const { Op, fn, col, QueryTypes } = require('sequelize');

const { createMessage, sendPushNotif } = require('../node-gcm/push-notification');

const user = async (uuid) => {
  return await db.Buddy_Club_User.findByPk(uuid);
};

const userNotificationId = async (uuid) => {
  return await db.Buddy_Club_User.findByPk(uuid, { attributes: ['notification_id'] });
};

const insertFollows = async (id_followed, id_following, act) => {

  switch (act) {
    case 'follow': {
      // #TODO the queries can be merged for normalization
      const [_, isNewRecord] = await db.Follow.findOrCreate({
        where: { id_followed, id_following },
        defaults: { id_followed, id_following }
      });

      if (!isNewRecord) {
        return;
      }

      const notifId = await userNotificationId(id_followed);
      const { dataValues: uFollowing } = await user(id_following);

      const msg = createMessage({
        title: "You have a new follower 👤",
        icon: "ic_launcher",
        body: "👋, " + uFollowing?.user_name,
      });

      msg.addData({
        click_action: `budyclub://Hoom`,
        imgUrl: null,
        room_id: null,
        type: 'push',
      });


      await db.Buddy_Club_User.increment('num_following', { by: 1,
        where: {
          user_id: {
            [Op.eq]: id_following,
          }
        },
        returning: true, });
      const [dataValues] = await db.Buddy_Club_User.increment('num_follower', { by: 1,
        where: {
          user_id: {
            [Op.eq]: id_followed,
          }
        },
        returning: true, });

      sendPushNotif(msg, [notifId?.notification_id]);

      return { num_following: dataValues[0][0]?.num_following, num_follower: dataValues[0][0]?.num_follower };
      // break;
    }

    case 'following': {
      // #TODO the queries can be merged for normalization
      const _response = await db.Follow.destroy({
        where: { id_followed, id_following }
      });

      if (_response === 0) {
        return;
      }

      await db.Buddy_Club_User.decrement('num_following', { by: 1,
        where: {
          user_id: {
            [Op.eq]: id_following
          }
        },
        returning: true, });

      const [dataValues] = await db.Buddy_Club_User.decrement('num_follower', { by: 1,
        where: {
          user_id: {
            [Op.eq]: id_followed,
          }
        },
        returning: true, });

      return { num_following: dataValues[0][0]?.num_following, num_follower: dataValues[0][0]?.num_follower };
      // break;
    }
  }

};

const getFollowFollowers = async (user_id, c) => {
  switch (c) {
    case 'followers': {
      return await db.Follow.findAll({
        where: {
          id_followed: {
            [Op.eq]: user_id,
          }
        },
        attributes: { exclude: ['updatedAt', 'createdAt'] },
        include: [
          {
            model: db.Buddy_Club_User,
            as: 'u_following',
            attributes: ['full_name', 'user_name', 'FB_id', 'user_id', 'bio'],
            include: [
              {
                model: db.Follow,
                required: false,
                as: 'follower',
                attributes: ['id_followed', 'id_following'],
              },
            ]
          }
        ]
      });
    }
    case 'following': {
      return await db.Follow.findAll({
        where: {
          id_following: {
            [Op.eq]: user_id,
          }
        },
        attributes: { exclude: ['updatedAt', 'createdAt'] },
        include: [
          {
            model: db.Buddy_Club_User,
            as: 'u_followed',
            attributes: ['full_name', 'user_name', 'FB_id', 'user_id', 'bio'],
            include: [
              {
                model: db.Follow,
                required: false,
                as: 'follower',
                attributes: ['id_followed', 'id_following'],
              },
            ]
          }
        ]
      });
    }
  }
}

const getNotificationIds = async (user_id) => {
  return await db.Follow.findAll({
    where: {
      id_following: {
        [Op.eq]: user_id,
        [Op.ne]: null,
      }
    },
    attributes: { exclude: ['updatedAt', 'createdAt'] },
    include: [
      {
        model: db.Buddy_Club_User,
        as: 'u_followed',
        attributes: ['notification_id'],
      }
    ]
  });
}

const updateUserProfile = async (d, user_id) => {
  const [_, affectedRows] = await db.Buddy_Club_User.update({ ...d }, {
    where: {
      user_id: {
        [Op.eq]: user_id,
      }
    },
    returning: true,
    plain: true,
  });

  if (affectedRows) {
    return d;
  }
}

const updateCurrentRoomId = async (room_id, user_id) => {
  return await db.Buddy_Club_User.update({ current_room_id: room_id }, {
    where: {
      user_id: {
        [Op.eq]: user_id,
      }
    },
    return: true,
    plain: true,
  });
}

const setIsUserOnline = async (online, user_id) => {
  return await db.Buddy_Club_User.update({
    online,
    last_online: Date.now(),
  }, {
    where: {
      user_id: {
        [Op.eq]: user_id,
      }
    },
    return: true,
    plain: true,
  });
}

const updateNotifiactionId = async (notification_id, user_id) => {
  const [_, affectedRows] = await db.Buddy_Club_User.update({ notification_id }, {
    where: {
      user_id: {
        [Op.eq]: user_id,
      }
    },
    returning: true,
    plain: true,
  });

  if (affectedRows) return true;
}

const getUser = async (uuid) => {
  if(uuid === 'favicon.ico')return;

  return await db.Buddy_Club_User.findOne({
    where: {
      user_id: {
        [Op.eq]: uuid,
      }
    },
    attributes: { exclude: ['updatedAt'] },
    // attributes: {
    //   include: [
    //     [db.Sequelize.fn('COUNT', db.Sequelize.col('following')), 'user_following'],
    //     [db.Sequelize.fn('COUNT', db.Sequelize.col('follower')), 'followers']
    //   ],
    // },
    // group: ['Buddy_Club_User.user_id', 'following.id_followed', 'following.id_following', 'follower.id_followed', 'follower.id_following'],
    include: [
      {
        model: db.Follow,
        required: false,
        as: 'following',
        attributes: ['id_followed', 'id_following'],
        include: [
          {
            model: db.Buddy_Club_User,
            as: 'u_followed',
            attributes: ['user_id', 'user_name', 'photo_url']
          }
        ]
      },
      {
        model: db.Follow,
        as: 'follower',
        attributes: ['id_followed', 'id_following'],
        include: [
          {
            model: db.Buddy_Club_User,
            as: 'u_following',
            attributes: ['user_id', 'user_name', 'photo_url']
          }
        ]
      },
    ],
  });
};

const searchUsers = async (query) => {
  return await db.sequelize.query(`SELECT full_name, user_name, "FB_id", user_id, num_following, num_follower FROM public."Buddy_Club_Users" WHERE document @@ to_tsquery(:q)`, {
    replacements: { q: `${query}:*` },
    type: QueryTypes.SELECT,
  })
}


module.exports = {
  user,
  insertFollows,
  getUser,
  getFollowFollowers,
  updateUserProfile,
  updateNotifiactionId,
  userNotificationId,
  getNotificationIds,
  updateCurrentRoomId,
  searchUsers,
  setIsUserOnline,
}
