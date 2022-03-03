"use strict";

const db = require('../models');

//sync({ force: true }) and sync({ alter: true }) can be destructive operations!!!!

db.sequelize.sync({ force: false })
  .then(() => {
    console.log('Connection has been established successfully.')
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });