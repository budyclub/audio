"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queries = void 0;
exports.queries = {
    getAllRooms: `SELECT * FROM buddyclub.rooms`,
    getRoom: `SELECT * from buddyclub.rooms WHERE room_id=? LIMIT 1`,
    getUsersInRoom: `SELECT * FROM buddyclub.user_in_room_by_room_id WHERE room_id=?`,
    getAllUsersInRooms: `SELECT * FROM buddyclub.user_in_room_by_room_id`,
};
//# sourceMappingURL=queries.js.map