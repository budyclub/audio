const express = require('express');
const login = require('./login');
// eslint-disable-next-line new-cap
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'oky',
  });
});

router.use('/login', login);

module.exports = router;
