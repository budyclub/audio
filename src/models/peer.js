'use strict';

const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Peer extends Model {

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(m) {
      // define association here
      Peer.belongsTo(m.Buddy_Club_User, {
        as: 'user',
        foreignKey: 'user_id',
      })
      Peer.belongsTo(m.Room, {
        as: 'peer',
        foreignKey: 'room_id',
        onDelete: 'CASCADE'
      });
      Peer.hasMany(m.Room_Messages, {
        foreignKey: 'user_id',
        as: 'my_messages_to_room',
        onDelete: 'CASCADE'
      })
    }
  }
  Peer.init({
    peer_id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    room_id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
    },
    user_id: {
      allowNull: false,
      type: DataTypes.UUID,
    },
    room_permisions: DataTypes.JSONB,
    joined_at: DataTypes.DATE,
    // left_at: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Peer',
  });

  return Peer;
};
