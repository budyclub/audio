'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Peers', {
      peer_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      room_id: {
        allowNull: false,
        primaryKey: true,
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
      },
      room_permisions: {
        type: Sequelize.JSONB
      },
      joined_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      left_at: {
        type: Sequelize.DATE,
      },
      spk_timestamp: {
        type: Sequelize.JSONB,
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
    await queryInterface.dropTable('Peers');
  }
};
