"use strict";

const Client = require("./utils/RabbitMQ");

function MessageQueue(ws, options) {
  return new Client(ws, options);
}

module.exports = MessageQueue;


// https://dokku.com/docs~v0.21.4/deployment/application-deployment
