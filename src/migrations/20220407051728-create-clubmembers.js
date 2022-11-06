'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Clubmembers', {
      club_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        references: {
          model: 'Clubs',
          key: 'club_id',
        },
        onDelete: 'CASCADE'
      },
      member_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        references: {
          model: 'Buddy_Club_Users',
          key: 'user_id',
        },
        onDelete: 'CASCADE'
      },
      member_sub_info: {
        type: Sequelize.JSONB
      },
      member_mode: {
        allowNull: false,
        type: Sequelize.ENUM('MEMBER', 'MODERATOR')
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
    await queryInterface.dropTable('Clubmembers');
  }
};
