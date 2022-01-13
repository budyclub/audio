'use strict';

const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Follow extends Model {

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(m) {
      // define association here
      Follow.belongsTo(m.Buddy_Club_User, { foreignKey: 'id_followed', as: 'u_followed' });
      Follow.belongsTo(m.Buddy_Club_User, { foreignKey: 'id_following', as: 'u_following' });
    }
  }
  Follow.init({
    id_followed: { type: DataTypes.UUID, primaryKey: true },
    id_following: { type: DataTypes.UUID, primaryKey: true }
  }, {
    sequelize,
    modelName: 'Follow',
  });

  return Follow;
};
