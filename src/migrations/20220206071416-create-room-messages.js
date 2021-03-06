'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Room_Messages', {
      message_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      room_id: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Rooms',
          key: 'room_id',
        },
        onDelete: 'CASCADE'
      },
      user_id: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Buddy_Club_Users',
          key: 'user_id',
        },
        onDelete: 'CASCADE'
      },
      message: {
        type: Sequelize.JSONB
      },
      mentions: {
        type: Sequelize.JSONB
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
    await queryInterface.dropTable('Room_Messages');
  }
};
