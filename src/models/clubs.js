'use strict';

const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Clubs extends Model {

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(m) {
      // define association here
      Clubs.belongsTo(m.Buddy_Club_User, {
        as: 'owner',
        foreignKey: 'club_owner',
        onDelete: 'CASCADE'
      });

      Clubs.hasMany(m.Clubmembers, {
        as: 'm',
        foreignKey: 'club_id',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      })
    }
  }
  Clubs.init({
    club_id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    club_name: DataTypes.STRING,
    club_title: DataTypes.STRING,
    club_owner: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    club_active: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    club_logo: DataTypes.STRING,
    club_topics: DataTypes.JSONB,
    club_settings: DataTypes.JSONB,
    club_approval_mode: DataTypes.ENUM('AUTO', 'BY_MODE'),
    club_rules: DataTypes.JSONB,
    club_hosting_mode: DataTypes.ENUM('MEMBERS', 'MODES')
  }, {
    sequelize,
    modelName: 'Clubs',
  });

  return Clubs;
};
