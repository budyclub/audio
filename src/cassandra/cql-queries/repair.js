"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteQueries = void 0;
exports.deleteQueries = {
    deleteRoom: `DELETE FROM rooms WHERE room_id=?`,
    deleteRoomUsers: `DELETE FROM buddyclub.user_in_room_by_room_id WHERE room_id=?`,
    removeUserInRoom: 'DELETE FROM buddyclub.user_in_room_by_room_id WHERE room_id=? AND created_at=?',
};
//# sourceMappingURL=repair.js.map