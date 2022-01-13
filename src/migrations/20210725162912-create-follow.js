/* eslint-disable no-inline-comments */
/* eslint-disable line-comment-position */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Follows', {
      // id: {
      //   allowNull: false,
      //   autoIncrement: true,
      //   primaryKey: true,
      //   type: Sequelize.INTEGER
      // },
      id_followed: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'Buddy_Club_Users', // name of Target model
          key: 'user_id', // key in Target model that we're referencing
        }
      },
      id_following: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'Buddy_Club_Users', // name of Target model
          key: 'user_id', // key in Target model that we're referencing
        }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Follows');
  }
};
