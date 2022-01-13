"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoom = exports.getAllRooms = exports.leaveRoom = exports.deleteUsersInRoom = exports.deleteRoom = exports._delMuteMap = exports._setMuteMap = exports._addMuteMap = exports._delActiveSpeaker = exports.setActiveSpeaker = exports.addActiveSpeaker = exports.updateUserRoomPermisons = exports._joinRoom = exports._creatRoom = exports.startCassandra = void 0;
const cassandra_driver_1 = require("cassandra-driver");
const path = require("path");
const createRoom_1 = __importDefault(require("./cql-queries/createRoom"));
const joinRoom_1 = __importDefault(require("./cql-queries/joinRoom"));
const upadateUserRoomPerm_1 = require("./cql-queries/upadateUserRoomPerm");
const otherRoomOp_1 = require("./cql-queries/otherRoomOp");
const repair_1 = require("./cql-queries/repair");
const queries_1 = require("./cql-queries/queries");
// const zipath = path.dirname(__dirname);
const p = path.dirname(require.main.filename || process.mainModule.filename);
console.log('file', p + '/secure-connect-buddy.zip');
let cqlConn;
const startCassandra = () => __awaiter(void 0, void 0, void 0, function* () {
    cqlConn = new cassandra_driver_1.Client({
        cloud: {
            secureConnectBundle: `${p}/secure-connect-buddy.zip`,
        },
        credentials: {
            username: process.env.DATASTAX_USERNAME || '',
            password: process.env.DATASTAX_PASSWORD || '',
        },
        keyspace: `buddyclub`,
        queryOptions: {
            isIdempotent: true,
            prepare: true,
        },
    });
});
exports.startCassandra = startCassandra;
const _creatRoom = (room_id, about_room, isPublic, created_by_id, room_name, muted_speakers_obj, block_speakers_obj) => __awaiter(void 0, void 0, void 0, function* () {
    const created_at = new Date();
    const active_speakers_obj = { [created_by_id]: true };
    try {
        const resp = yield cqlConn.execute(createRoom_1.default, [
            room_id,
            created_by_id,
            about_room,
            isPublic,
            room_name,
            active_speakers_obj,
            muted_speakers_obj,
            block_speakers_obj,
            created_at,
        ]);
        return { created_at, resp };
    }
    catch (err) {
        console.log(err);
        return err;
    }
});
exports._creatRoom = _creatRoom;
const _joinRoom = (room_id, user_id, user_name, photo_url, room_permisions) => __awaiter(void 0, void 0, void 0, function* () {
    const created_at = cassandra_driver_1.types.TimeUuid.now();
    try {
        const resp = yield cqlConn.execute(joinRoom_1.default, [
            room_id,
            created_at,
            user_id,
            user_name,
            photo_url,
            room_permisions,
        ], { prepare: true });
        return { created_at: created_at.toString(), resp };
    }
    catch (err) {
        console.log(err);
        return err;
    }
});
exports._joinRoom = _joinRoom;
const updateUserRoomPermisons = (value, room_id, created_at, key) => __awaiter(void 0, void 0, void 0, function* () {
    switch (key) {
        case "isMod":
            try {
                yield cqlConn.execute(upadateUserRoomPerm_1.isMod, [
                    value,
                    room_id,
                    created_at
                ], { prepare: true });
            }
            catch (err) {
                console.log(err);
            }
            break;
        case "isSpeaker":
            try {
                yield cqlConn.execute(upadateUserRoomPerm_1.isSpeaker, [
                    value,
                    room_id,
                    created_at
                ], { prepare: true });
            }
            catch (err) {
                console.log(err);
            }
            break;
        default:
            try {
                yield cqlConn.execute(upadateUserRoomPerm_1.requested_to_speak, [
                    value,
                    room_id,
                    created_at
                ], { prepare: true });
            }
            catch (err) {
                console.log(err);
            }
            break;
    }
});
exports.updateUserRoomPermisons = updateUserRoomPermisons;
const addActiveSpeaker = (room_id, active_speakers_obj, created_at) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield cqlConn.execute(otherRoomOp_1.addActiveSpeakers, [active_speakers_obj, room_id, created_at], { prepare: true });
    }
    catch (err) {
        return err;
    }
});
exports.addActiveSpeaker = addActiveSpeaker;
const setActiveSpeaker = (room_id, created_at, value, user_id) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield cqlConn.execute(otherRoomOp_1.setActiveSpeakers, [user_id, value, room_id, created_at], { prepare: true });
    }
    catch (err) {
        return err;
    }
});
exports.setActiveSpeaker = setActiveSpeaker;
const _delActiveSpeaker = (room_id, created_at, user_id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield cqlConn.execute(otherRoomOp_1.delActiveSpeaker, [user_id, room_id, created_at], { prepare: true });
});
exports._delActiveSpeaker = _delActiveSpeaker;
const _addMuteMap = (room_id, user_id, value, created_at) => __awaiter(void 0, void 0, void 0, function* () {
    const v = !value;
    const muted_speakers_obj = { [user_id]: v };
    return yield cqlConn.execute(otherRoomOp_1.addMuteMap, [muted_speakers_obj, room_id, created_at], { prepare: true });
});
exports._addMuteMap = _addMuteMap;
const _setMuteMap = (room_id, created_at, value, user_id) => __awaiter(void 0, void 0, void 0, function* () {
    const v = !value;
    return yield cqlConn.execute(otherRoomOp_1.setMuteMap, [user_id, v, room_id, created_at], { prepare: true });
});
exports._setMuteMap = _setMuteMap;
const _delMuteMap = (room_id, created_at, user_id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield cqlConn.execute(otherRoomOp_1.delMuteMap, [user_id, room_id, created_at], { prepare: true });
});
exports._delMuteMap = _delMuteMap;
const deleteRoom = (room_id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield cqlConn.execute(repair_1.deleteQueries.deleteRoom, [room_id]);
});
exports.deleteRoom = deleteRoom;
const deleteUsersInRoom = (room_id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield cqlConn.execute(repair_1.deleteQueries.deleteRoomUsers, [room_id]);
});
exports.deleteUsersInRoom = deleteUsersInRoom;
const leaveRoom = (room_id, created_at) => __awaiter(void 0, void 0, void 0, function* () {
    return yield cqlConn.execute(repair_1.deleteQueries.removeUserInRoom, [room_id, created_at]);
});
exports.leaveRoom = leaveRoom;
const getAllRooms = () => __awaiter(void 0, void 0, void 0, function* () {
    const resp = yield cqlConn.execute(queries_1.queries.getAllRooms);
    const rooms = [];
    for (const room of resp) {
        const members = yield cqlConn.execute(queries_1.queries.getUsersInRoom, [room.room_id]);
        const roomMembers = members.rows.map(m => m);
        rooms.push(Object.assign(Object.assign({}, room), { roomMembers }));
    }
    return (JSON.stringify(rooms));
});
exports.getAllRooms = getAllRooms;
const getRoom = (room_id) => __awaiter(void 0, void 0, void 0, function* () {
    const rm = yield cqlConn.execute(queries_1.queries.getRoom, [room_id]);
    if (rm.rowLength === 0) {
        return JSON.stringify([]);
    }
    const members = yield cqlConn.execute(queries_1.queries.getUsersInRoom, [room_id]);
    if (members.rowLength === 0) {
        return JSON.stringify([]);
    }
    const roomMembers = members.rows.map(m => m);
    const d = Object.assign(Object.assign({}, rm.rows[0]), { roomMembers });
    return JSON.stringify(d);
});
exports.getRoom = getRoom;
//# sourceMappingURL=index.js.map