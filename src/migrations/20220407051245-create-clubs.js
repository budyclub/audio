'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Clubs', {
      club_id: {
        allowNull: false,
        primaryKey: true,
        unique: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      club_name: {
        type: Sequelize.STRING
      },
      club_title: {
        type: Sequelize.STRING
      },
      club_owner: {
        allowNull: false,
        unique: true,
        type: Sequelize.UUID,
        references: {
          model: 'Buddy_Club_Users',
          key: 'user_id',
        },
        onDelete: 'CASCADE'
      },
      club_active: {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE')
      },
      club_logo: {
        type: Sequelize.STRING
      },
      club_topics: {
        type: Sequelize.JSONB
      },
      club_settings: {
        type: Sequelize.JSONB
      },
      club_approval_mode: {
        type: Sequelize.ENUM('AUTO', 'BY_MODE')
      },
      club_rules: {
        type: Sequelize.JSONB
      },
      club_hosting_mode: {
        type: Sequelize.ENUM('MEMBERS', 'MODES')
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
    await queryInterface.dropTable('Clubs');
  }
};
