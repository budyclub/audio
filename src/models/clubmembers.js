'use strict';

const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Clubmembers extends Model {

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Clubmembers.init({
    club_id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID
    },
    member_id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID
    },
    member_mode: {
      allowNull: false,
      type: DataTypes.ENUM('MEMBER', 'MODERATOR')
    },
    member_sub_info: DataTypes.JSONB
  }, {
    sequelize,
    modelName: 'Clubmembers',
  });

  return Clubmembers;
};
