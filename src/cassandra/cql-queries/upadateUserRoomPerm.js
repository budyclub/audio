"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMod = exports.isSpeaker = exports.requested_to_speak = void 0;
exports.requested_to_speak = `
UPDATE user_in_room_by_room_id 
SET room_permisions.requested_to_speak=?
WHERE room_id=? 
AND created_at=?
`;
exports.isSpeaker = `
UPDATE user_in_room_by_room_id 
SET room_permisions.isSpeaker=?
WHERE room_id=? 
AND created_at=?
`;
exports.isMod = `
UPDATE user_in_room_by_room_id 
SET room_permisions.isMod=?
WHERE room_id=? 
AND created_at=?
`;
//# sourceMappingURL=upadateUserRoomPerm.js.map