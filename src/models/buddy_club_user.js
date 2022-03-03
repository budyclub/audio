'use strict';

// const {v} = require('uuid');
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Buddy_Club_User extends Model {

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(m) {
      // define association here
      Buddy_Club_User.hasMany(m.Follow, {
        as: 'follower',
        foreignKey: 'id_followed'
      });
      Buddy_Club_User.hasMany(m.Follow, {
        as: 'following',
        foreignKey: 'id_following'
      });
    }
  }
  Buddy_Club_User.init({
    user_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    providerId: DataTypes.STRING,
    FB_id: DataTypes.BIGINT,
    full_name: DataTypes.STRING,
    user_name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    last_online: DataTypes.DATE,
    photo_url: DataTypes.STRING,
    background_photo_url: DataTypes.STRING,
    bio: DataTypes.TEXT,
    num_following: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    num_follower: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    current_room_id: DataTypes.UUID,
    online: DataTypes.BOOLEAN,
    notification_id: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Buddy_Club_User',
  });
  // Buddy_Club_User.beforeCreate((user) => user.user_id = uuid())

  return Buddy_Club_User;

};
