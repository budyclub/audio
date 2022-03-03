'use strict';

const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Room extends Model {

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(m) {
      // define association here
      Room.hasMany(m.Peer, {
        as: 'peers',
        foreignKey: 'room_id',
        onDelete: 'CASCADE'
      });

      Room.belongsTo(m.Buddy_Club_User, {
        as: 'room_creator',
        foreignKey: 'created_by_id',
        onDelete: 'CASCADE'
      });

      Room.hasMany(m.Room_Messages, {
        as: 'room_messages',
        foreignKey: 'room_id',
        onDelete: 'CASCADE'
      })
    }
  }
  Room.init({
    room_id: {
      primaryKey: true,
      autoIncrement: false,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    about_room: DataTypes.STRING,
    room_name: DataTypes.STRING,
    is_public: DataTypes.BOOLEAN,
    muted_speakers_obj: DataTypes.JSONB,
    block_speakers_obj: DataTypes.JSONB,
    speakers: DataTypes.JSONB,
    raise_hand_active: DataTypes.BOOLEAN,
    active_speakers_obj: DataTypes.BOOLEAN,
    requests: DataTypes.JSONB
  }, {
    sequelize,
    modelName: 'Room',
  });

  return Room;
};
