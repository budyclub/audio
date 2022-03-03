'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Rooms', {
      room_id: {
        allowNull: false,
        primaryKey: true,
        unique: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      about_room: {
        type: Sequelize.STRING
      },
      room_name: {
        type: Sequelize.STRING,
      },
      is_public: {
        type: Sequelize.BOOLEAN
      },
      created_by_id: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Buddy_Club_Users',
          key: 'user_id',
        },
        onDelete: 'CASCADE'
      },
      muted_speakers_obj: {
        type: Sequelize.JSONB
      },
      block_speakers_obj: {
        type: Sequelize.JSONB
      },
      speakers: {
        type: Sequelize.JSONB
      },
      raise_hand_active: {
        type: Sequelize.BOOLEAN
      },
      active_speakers_obj: {
        type: Sequelize.JSONB
      },
      requests: {
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
    await queryInterface.dropTable('Rooms');
  }
};
