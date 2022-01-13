"use strict";

/* eslint-disable no-undef */
const debugModule = require('debug');
const { EventEmitter } = require('eventemitter3');
const WebSocket = require('ws');
// const amqp = require('amqplib');
const querystring = require('querystring');
const { v4: uuidV4 } = require('uuid');

class Websocket extends EventEmitter {
  constructor() {
    super();
    this.ws = new Map(); // key ws
  }
}