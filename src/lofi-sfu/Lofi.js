/* eslint-disable no-useless-return */
/* eslint-disable no-inline-comments */
const { EventEmitter } = require("eventemitter3");
const config = require('./config');

class Lofi extends EventEmitter {

  static async createRoom(workers, room_id) {
    let workerIdx = 0
    const { worker, router } = workers[workerIdx];

    // eslint-disable-next-line no-plusplus
    workerIdx++;
    workerIdx %= workers?.length;

    // const speakerObserver = await router?.createActiveSpeakerObserver({
    //   interval: 300
    // });

    const audioLevelObserver = await router?.createAudioLevelObserver({
      // maxEntries: 1,
      threshold: -80,
      interval: 800
    });

    return new Lofi({
      worker,
      router,
      state: {},
      // speakerObserver,
      audioLevelObserver
    },
    room_id);
  }

  /**
   * room Object
   * @param {Object} room
   * @param {String} room_id
   */

  constructor(room, room_id) {
    console.log('constructor() [room_id:"%s"]', room_id);
    super();

    /** rooms */
    this.rooms = { [room_id]: { ...room } };

    /** room id */
    this.room_id = room_id;

    /** audioLevelObserver */
    this.audioLevelObserver = room.audioLevelObserver;

    /** activeSpeakerObserver */
    // this.activeSpeakerObserver = room.speakerObserver;

    /** Handle audioObservers */
    // this._handleAudioObservers(room_id);

    /** Set flag should reconect */
    this.shouldReconnect = false;
  }

  /**
   * Establish a transport connection with dtlsParameters
   * @param {Object} param0
   * @param {String} user_id
   * @param {Websocket} ws
   * @returns {Promise<Boolean>}
   */

  async connect_transport({ room_id, dtlsParameters, peer_id, direction },
    user_id, ws) {
    if (!this.rooms[room_id]?.state[peer_id]) {
      return false;
    }
    const { state } = this.rooms[room_id];
    const transport = direction === "recv"
      ? state[peer_id].recvTransport
      : state[peer_id].sendTransport;

    if (!transport) {
      return false;
    }

    try {
      await transport.connect({ dtlsParameters });
    } catch (e) {
      console.log(`@connect_transport_${direction}_error`, e);
      ws[user_id].ws.send(JSON.stringify({
        act: `@connect_transport_${direction}_done`,
        dt: { error: e.message, room_id },
      }));

      return;
    }

    console.log("connect to transport done", transport.appData);
    ws[user_id].ws.send(JSON.stringify({
      act: `@connect_transport_${direction}_done`,
      dt: { room_id },
    }));

    transport.on('dtlsstatechange', dtlsState => {
      if (dtlsState === 'failed' || dtlsState === 'closed') {
        // peer disconnected; called transport.close() or closed browser tab
        console.log(
          'WebRtcTransport "dtlsstatechange" event, dtlsState',
          dtlsState
        );
        transport.close();
      }
    });

    transport.on('icestatechange', (icestate) => {
      console.log('ICE state changed to %s', icestate);
    });

    transport.observer.on('close', () => {
      console.log(
        'transport closed!',
      );
    });
  }

  /**
   * send track
   * @param {Object} object
   * @param {String} user_id
   */

  async send_tracks(data, user_id, ws) {
    const {
      room_id,
      transportId,
      direction,
      peer_id: my_peer_id,
      kind,
      rtpParameters,
      rtpCapabilities,
      paused,
      appData,
    } = data;

    if(!(room_id in this.rooms)) {
      return;
    }

    const { state, router } = this.rooms[room_id];
    const { sendTransport, producer: previousProducer, consumers } = state[my_peer_id];
    const transport = sendTransport;

    if (!transport) {
      return;
    }

    try {
      if (previousProducer) {
        console.log('--------closing previous producer and consumer--------');
        previousProducer?.close();
        consumers.forEach((c) => c.close());
        // #todo give some time for frontend to get update, but this can be removed

        ws[my_peer_id].ws.send(JSON.stringify({
          room_id,
          act: "close_consumer",
          dt: { producerId: previousProducer.id, room_id },
        }));
      }

      const producer = await transport.produce({
        kind,
        rtpParameters,
        paused,
        appData: { ...appData, peer_id: my_peer_id, transportId },
      });

      this.rooms[room_id].state[my_peer_id].producer = producer;

      for (const their_peer_id of Object.keys(state)) {
        if (their_peer_id === my_peer_id) {
          continue;
        }
        const peer_transport = state[their_peer_id]?.recvTransport;

        if (!peer_transport) {
          continue;
        }
        try {
          const d = await this.createConsumer(
            router,
            producer,
            rtpCapabilities,
            peer_transport,
            my_peer_id,
            state[their_peer_id]
          );

          console.log('new peer speaker data):-');
          ws[their_peer_id].ws.send(JSON.stringify({
            act: "on_new_peer_speaker",
            dt: { ...d, room_id },
          }));
        } catch (e) {
          console.log('on_new_peer_speaker', e.message);
        }
      }

      ws[user_id].ws.send(JSON.stringify({
        act: `@send_track_${direction}_done`,
        dt: {
          id: producer.id,
          room_id,
        },
      }));

      if (kind === 'audio') {
        // this.activeSpeakerObserver.addProducer({ producerId: producer.id })
        //   .catch((err) => {
        //     console.log(err);
        //   });

        this.audioLevelObserver.addProducer({ producerId: producer.id })
          .catch((err) => {
            console.log(err);
          });
      }

    } catch (e) {
      console.log(e);
      ws[user_id].ws.send(JSON.stringify({
        act: `@send_track_${direction}_done`,
        dt: {
          error: e.message,
          room_id,
        },
      }));
    }
  }

  /**
   *
   * @param {Object} param0
   * @param {String} user_id
   * @param {Object} ws
   * @returns
   */

  async recv_tracks({ room_id, peer_id: myPeerId, rtpCapabilities }, user_id, ws) {
    if (!this.rooms[room_id].state[myPeerId]) {
      return;
    }
    const { state, router } = this.rooms[room_id];
    const transport = state[myPeerId].recvTransport;

    if(!transport) return;

    const consumerParametersArr = [];

    for (const theirPeerId of Object.keys(state)) {
      const peerState = state[theirPeerId];

      if (theirPeerId === myPeerId || !peerState || !peerState.producer) {
        continue;
      }
      try {
        const { producer } = peerState;

        consumerParametersArr.push(
          await this.createConsumer(
            router,
            producer,
            rtpCapabilities,
            transport,
            myPeerId,
            state[theirPeerId]
          )
        );
      } catch (e) {
        console.log(e.message);
        continue;
      }
    }
    ws[user_id].ws?.send(JSON.stringify({
      act: "@recv_tracks_done",
      dt: { consumerParametersArr, room_id },
    }));
  }


  /**
   * When a room or mod joins the room or creates a room
   * @param {String} room_id
   * @param {String} peer_id
   * @param {String} user_id
   */
  async join_as_speaker(room_id, peer_id) {

    if(!(room_id in this.rooms)) {
      this.rooms[room_id] = await this.createWorkers();
    }

    const { router, state } = this.rooms[room_id];

    /**
     * create both recv and send transport
     */
    const [recvTransport, sendTransport] = await Promise.all([
      this.createTransport("recv", router, peer_id),
      this.createTransport("send", router, peer_id)
    ]).catch((err) => {
      console.log(err);
    });

    if (peer_id in state) {
      this.closePeer(state[peer_id]);
    }

    this.rooms[room_id].state[peer_id] = {
      recvTransport,
      sendTransport,
      consumers: [],
      producer: null,
    };

    return {
      room_id,
      peer_id,
      routerRtpCapabilities: this.rooms[room_id]?.router.rtpCapabilities,
      recvTransportOptions: this.transportToOptions(recvTransport),
      sendTransportOptions: this.transportToOptions(sendTransport),
    };

  }

  /**
   *
   * @param {*} param0
   * @param {string} user_id
   * @param {object} ws
   * @returns
   */

  async join_room_as_listener({ room_id, peer_id }, user_id, ws) {
    if (!(room_id in this.rooms)) {
      console.log('room does not exist');

      return false;
    }
    console.log("joined room as listener", peer_id);
    const { state, router } = this.rooms[room_id];

    let recvTransport;

    try {
      recvTransport = await this.createTransport("recv", router, peer_id);
    } catch (err) {
      console.log(err);
    }
    if (state[peer_id]) {
      this.closePeer(state[peer_id]);
    }
    this.rooms[room_id].state[peer_id] = {
      recvTransport,
      consumers: [],
      producer: null,
      sendTransport: null,
    };

    ws?.send(JSON.stringify({
      act: "joined_as_listener",
      dt: {
        room_id,
        peer_id,
        routerRtpCapabilities: this.rooms[room_id].router.rtpCapabilities,
        recvTransportOptions: this.transportToOptions(recvTransport),
      },
      user_id,
    }));
  }

  /**
   * Method to add a new Speaker
   * @param {Object} param0
   * @param {String} user_id
   * @param {Websocket} ws
   * @returns {Promise<Boolean>}
   */

  async add_speaker({ room_id, peer_id }, user_id, ws) {
    if (!this.rooms[room_id].state[peer_id]) {
      return;
    }
    const { router } = this.rooms[room_id];
    const sendTransport = await this.createTransport("send", router, peer_id);

    this.rooms[room_id].state[peer_id]?.sendTransport?.close();
    this.rooms[room_id].state[peer_id].sendTransport = sendTransport;
    ws?.send(JSON.stringify({
      act: "on_added_as_speaker",
      dt: {
        sendTransportOptions: this.transportToOptions(sendTransport),
        routerRtpCapabilities: router?.rtpCapabilities,
        room_id,
      },
      user_id,
    }));
  }

  /**
   *
   * @param {*} param0
   * @param {*} user_id
   * @returns
   */

  remove_speaker({ room_id, peer_id }, user_id, ws) {
    if (room_id in this.rooms) {
      const peer = this.rooms[room_id].state[peer_id];

      peer?.producer?.close();
      peer?.sendTransport?.close();
    }

    return{ user_id, act: "speaker_removed", room_id };
  }

  /**
   *
   * @param {*} param0
   * @param {String} user_id
   * @returns
   */

  leave_room(room_id, peer_id) {
    if(!(room_id in this.rooms)) return;
    if (peer_id in this.rooms[room_id].state) {
      this.closePeer(this.rooms[room_id].state[peer_id]);
      console.log('closing peer');
      // eslint-disable-next-line prefer-reflect
      delete this.rooms[room_id].state[peer_id];

      return;
    }
    if (Object.keys(this.rooms[room_id]?.state).length === 0) {
      if (!(room_id in this.rooms)) {
        return;
      }
      delete this.rooms[room_id];
    }

    return { peer_id, act: "good_bye_room", room_id }
  }

  /**
   *
   * @param {*} room_id
   * @param {*} user_id
   * @returns
   */

  destroy_room(room_id, user_id) {
    if (room_id in this.rooms) {
      for (const peer of Object.values(this.rooms[room_id]?.state)) {
        this.closePeer(peer);
      }
      if (!(room_id in this.rooms)) {
        return;
      }
      delete this.rooms[room_id];

      return { user_id, act: "room_deleted", room_id };
    }
  }

  // /**
  //  *
  //  */
  // _handleAudioObservers(room_id) {
  //   this.audioLevelObserver.on('volumes', (volumes) => {
  //     const { producer: { appData }, volume } = volumes[0];
  //     // console.log('audioLevelObserver [volume:"%s"]', volume, appData, room_id);
  //     this.emit('speakingchange', { user_id: appData.peer_id, room_id, volume });
  //   });

  //   this.audioLevelObserver.on('silence', (silence) => {
  //     console.log('on silence [silence:"%s"]', silence);
  //     // this.emit('speakingchange', { user_id: appData.peer_id, room_id, volume });
  //   });

  //   this.activeSpeakerObserver.on('dominantspeaker', (dSpk) => {
  //     console.log('dominantspeaker [spk: "%s"]', dSpk?.producer);
  //   });
  // }

  /**
   *
   * @param {String} direction
   * @param {Object} router
   * @param {String} peer_id
   * @returns
   */

  async createTransport(direction, router, peer_id) {
    const {
      listenIps,
      initialAvailableOutgoingBitrate,
      minimumAvailableOutgoingBitrate,
      maxSctpMessageSize
    } = config.mediasoup.webRtcTransport;
    const transport = await router?.createWebRtcTransport({
      listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
      minimumAvailableOutgoingBitrate,
      maxSctpMessageSize,
      appData: { peer_id, clientDirection: direction },
    });


    return transport;
  }

  /**
   *
   * @param {*} router
   * @param {*} producer
   * @param {*} rtpCapabilities
   * @param {*} transport
   * @param {*} peer_id
   * @param {*} peerConsuming
   * @returns
   */

  async createConsumer(
    router,
    producer,
    rtpCapabilities,
    transport,
    peer_id,
    peerConsuming
  ) {
    if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
      throw new Error(
        `recv-track: client cannot consume ${producer.appData.peer_id}`
      );
    }

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: false, /** see note about always starting paused on mediasoup docs */
      appData: { peer_id, mediaPeerId: producer.appData.peer_id },
    });

    peerConsuming.consumers.push(consumer);

    return {
      peer_id: producer.appData.peer_id,
      consumerParameters: {
        producerId: producer.id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused,
      },
    };
  }

  closePeer(state) {
    state.producer?.close();
    state.recvTransport?.close();
    state.sendTransport?.close();
    state.consumers.forEach((c) => c.close());
  }

  transportToOptions({
    id,
    iceParameters,
    iceCandidates,
    dtlsParameters,
  }) {
    return {
      id, iceParameters, iceCandidates, dtlsParameters
    }
  }


}
module.exports = Lofi;
