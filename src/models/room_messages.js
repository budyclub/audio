'use strict';

const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Room_Messages extends Model {

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(m) {
      // define association here
      Room_Messages.belongsTo(m.Buddy_Club_User, {
        foreignKey: 'user_id',
        as: 'peer_messages'
      });
      Room_Messages.belongsTo(m.Room, {
        foreignKey: 'room_id',
        as: 'room_message'
      });
    }
  }
  Room_Messages.init({
    message_id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    room_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    message: DataTypes.JSONB,
    mentions: DataTypes.JSONB
  }, {
    sequelize,
    modelName: 'Room_Messages',
  });

  return Room_Messages;
};
