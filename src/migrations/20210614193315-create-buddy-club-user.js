'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Buddy_Club_Users', {
      user_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      providerId: {
        type: Sequelize.STRING
      },
      FB_id: {
        type: Sequelize.BIGINT
      },
      full_name: {
        type: Sequelize.STRING,
        unique: true,
      },
      user_name: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING,
        unique: true,
        validate: {
          isEmail: {
            args: true,
            msg: 'Invalid email address',
          },
        },
      },
      last_online: {
        type: Sequelize.DATE
      },
      photo_url: {
        type: Sequelize.STRING
      },
      background_photo_url: {
        type: Sequelize.STRING
      },
      bio: {
        type: Sequelize.TEXT
      },
      current_room_id: {
        unique: true,
        type: Sequelize.UUID
      },
      online: {
        type: Sequelize.BOOLEAN
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
    await queryInterface.dropTable('Buddy_Club_Users');
  }
};
