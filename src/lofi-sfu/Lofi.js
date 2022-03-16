const { EventEmitter } = require("eventemitter3");
const { Server } = require("../dusla/server");
const config = require('./config');

class Lofi extends EventEmitter {

  static async createRoom(workers, room_id) {
    let workerIdx = 0
    const { worker, router } = workers[workerIdx];

    workerIdx += 1;
    workerIdx %= workers?.length;

    const speakerObserver = await router?.createActiveSpeakerObserver({
      interval: 300
    });

    const audioLevelObserver = await router?.createAudioLevelObserver({
      maxEntries: 1,
      threshold: -80,
      interval: 300
    });

    return new Lofi({
      worker,
      router,
      state: {},
      speakerObserver,
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
    this.activeSpeakerObserver = room.speakerObserver;

    /** Handle audioObservers */
    this._handleAudioObservers(room_id);

    /** Set flag should reconect */
    this.shouldReconnect = false;
  }

  /**
   * Establish a transport connection with dtlsParameters
   * @param {Object} param0
   * @param {String} user_id
   * @param {Server} ctx
   * @returns {Promise<Boolean>}
   */

  async connect_transport({ room_id, dtlsParameters, peer_id, direction },
    user_id, ctx) {
    if (!this.rooms[room_id].state[peer_id]) {
      return false;
    }
    const ws = ctx._ws.get(peer_id);
    const { state } = this.rooms[room_id];
    const transport = direction === "recv"
      ? state[peer_id].recvTransport
      : state[peer_id].sendTransport;

    if (!transport) {
      return Promise.reject(new Error('No webrtc transport has been created!!!'))
    }

    try {
      await transport.connect({ dtlsParameters });
    } catch (e) {
      console.log(`@connect_transport_${direction}_error`, e);
      await ctx.sendWsMsg(ws, ctx.encodeMsg({
        act: `@connect_transport_${direction}_done`,
        dt: { error: e.message, room_id },
      }));

      return;
    }

    console.log("connect to transport done", transport.appData);
    await ctx.sendWsMsg(ws, ctx.encodeMsg({
      act: `@connect_transport_${direction}_done`,
      dt: { room_id },
    }));

    transport.on('dtlsstatechange', dtlsState => {
      if (dtlsState === 'failed' || dtlsState === 'closed') {
        // peer disconnected; called transport.close() or closed browser tab
        console.log(
          'WebRtcTransport "dtlsstatechange" event, dtlsState',
          { direction,
            dtlsState }
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
   * @param {Server} ctx
   */

  async send_tracks(data, user_id, ctx) {
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
      return Promise.reject(new Error('Room does not exist', room_id));
    }
    const ws = ctx._ws.get(user_id);
    const { state, router } = this.rooms[room_id];
    const { sendTransport, producer: previousProducer, consumers } = state[my_peer_id];
    const transport = sendTransport;

    if (!transport) {
      return Promise.reject(new Error('Lofi no Transport'));
    }

    try {
      if (previousProducer) {
        console.log('--------closing previous producer and consumer--------');
        previousProducer?.close();
        consumers.forEach((c) => c.close());
        // #todo give some time for frontend to get update, but this can be removed

        await ctx.sendWsMsg(ws, ctx.encodeMsg({
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

      for await(const their_peer_id of Object.keys(state)) {
        if (their_peer_id === my_peer_id) {
          continue;
        }
        const peer_transport = state[their_peer_id]?.recvTransport ?? null;

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

          const their_peer_ws = ctx._ws.get(their_peer_id);

          console.log('new peer speaker data):-');
          await ctx.sendWsMsg(their_peer_ws, ctx.encodeMsg({
            act: "on_new_peer_speaker",
            dt: { ...d, room_id },
          }));
        } catch (e) {
          console.log('on_new_peer_speaker', e.message);
        }
      }

      await ctx.sendWsMsg(ws, ctx.encodeMsg({
        act: `@send_track_${direction}_done`,
        dt: {
          id: producer.id,
          room_id,
        },
      }));

      if (kind === 'audio') {
        this.activeSpeakerObserver.addProducer({ producerId: producer.id })
          .catch((err) => {
            console.log(err);
          });

        this.audioLevelObserver.addProducer({ producerId: producer.id })
          .catch((err) => {
            console.log(err);
          });
      }

    } catch (e) {
      console.log(e);
      await ctx.sendWsMsg(ws, ctx.encodeMsg({
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
   * @param {Server} ctx
   * @returns
   */

  async recv_tracks({ room_id, peer_id: myPeerId, rtpCapabilities }, user_id, ctx) {
    if (!this.rooms[room_id].state[myPeerId]) {
      return;
    }

    const ws = ctx._ws.get(user_id);
    const { state, router } = this.rooms[room_id];
    const transport = state[myPeerId]?.recvTransport ?? null;

    if(!transport) {
      return Promise.reject(new Error('Lofi no Transport'));
    }

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
    await ctx.sendWsMsg(ws, ctx.encodeMsg({
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
      return Promise.reject(new Error('Room does not exist', room_id));
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
      await this.closePeer(state[peer_id]);
    }

    this.rooms[room_id].state[peer_id] = {
      recvTransport,
      sendTransport,
      consumers: [],
      producer: null,
    };

    return {
      routerRtpCapabilities: this.rooms[room_id].router.rtpCapabilities,
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

  async join_room_as_listener(room_id, peer_id) {
    if (!(room_id in this.rooms)) {
      return Promise.reject(new Error('Room does not exist', room_id));
    }

    const { state, router } = this.rooms[room_id];

    if (state[peer_id]) {
      await this.closePeer(state[peer_id]);
    }

    let recvTransport;

    try {
      recvTransport = await this.createTransport("recv", router, peer_id);
    } catch (err) {
      console.log(err);
    }

    this.rooms[room_id].state[peer_id] = {
      recvTransport,
      consumers: [],
      producer: null,
      sendTransport: null,
    };

    return{
      routerRtpCapabilities: this.rooms[room_id].router.rtpCapabilities,
      recvTransportOptions: this.transportToOptions(recvTransport),
    }

  }

  /**
   * Method to add a new Speaker
   * @param {Object} param0
   * @param {String} user_id
   * @param {Websocket} ws
   * @returns {Promise}
   */

  async add_speaker(room_id, peer_id) {
    if (!this.rooms[room_id].state[peer_id]) {
      return;
    }
    const { router } = this.rooms[room_id];
    const sendTransport = await this.createTransport("send", router, peer_id);

    if(this.rooms[room_id].state[peer_id].sendTransport) {
      this.rooms[room_id].state[peer_id].sendTransport.close();
    }
    this.rooms[room_id].state[peer_id].sendTransport = sendTransport;

    return {
      sendTransportOptions: this.transportToOptions(sendTransport),
      // sendTransportOptions: { ...sendTransport },
      routerRtpCapabilities: router.rtpCapabilities,
    }
  }

  /**
   *
   * @param {*} param0
   * @param {*} user_id
   * @returns
   */

  async remove_speaker(room_id, peer_id) {
    return new Promise((resolve, _) => {
      if (room_id in this.rooms) {
        const peer = this.rooms[room_id].state[peer_id];

        peer.producer.close();
        peer.sendTransport.close();
      }

      resolve({ act: "speaker_removed", dt: { room_id, peer_id } });
    });
  }

  /**
   *
   * @param {*} param0
   * @param {String} user_id
   * @returns
   */

  async leave_room(room_id, peer_id) {
    if(!(room_id in this.rooms)) return;
    if (peer_id in this.rooms[room_id].state) {
      await this.closePeer(this.rooms[room_id].state[peer_id]);
      // eslint-disable-next-line prefer-reflect
      delete this.rooms[room_id].state[peer_id];
    }
    if (Object.keys(this.rooms[room_id].state).length === 0) {
      if (!(room_id in this.rooms)) {
        return;
      }
      // delete this.rooms[room_id];
    }

    return { act: "peer_left", dt: { room_id, peer_id } }
  }

  /**
   *
   * @param {*} room_id
   * @param {*} user_id
   * @returns
   */

  async destroy_room(room_id, user_id) {
    if (room_id in this.rooms) {
      for (const peer of Object.values(this.rooms[room_id].state)) {
        await this.closePeer(peer);
      }
      if (!(room_id in this.rooms)) {
        return;
      }
      delete this.rooms[room_id];

      return { act: "room_deleted", dt: { room_id } };
    }
  }

  /**
   *
   */
  _handleAudioObservers(room_id) {
    // this.audioLevelObserver.on('volumes', (volumes) => {
    //   const { producer: { appData }, volume } = volumes[0];

    //   // console.log('audioLevelObserver [volume:"%s"]', volume, appData, room_id);

    //   this.emit(`${room_id}`, { user_id: appData.peer_id, room_id, volume });
    // });

    // this.audioLevelObserver.on('silence', (silence) => {
    //   console.log('on silence [silence:"%s"]', silence);

    //   this.emit(`${room_id}`, { silence });
    // });

    // this.activeSpeakerObserver.on('dominantspeaker', (dps) => {
    //   console.log('dominantspeaker [spk: "%s"]', dps?.producer);
    //   this.emit(`${room_id}`, dps);
    // });
  }

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
    const transport = await router.createWebRtcTransport({
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
      paused: false,
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

  async closePeer(state) {
    return await Promise.all([
      state.producer?.close(),
      state.recvTransport?.close(),
      state.sendTransport?.close(),
      state.consumers.forEach((c) => c.close()),
    ]).catch(err => console.log(err))
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
