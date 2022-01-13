"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.delMuteMap = exports.setMuteMap = exports.addMuteMap = exports.delActiveSpeaker = exports.setActiveSpeakers = exports.addActiveSpeakers = void 0;
exports.addActiveSpeakers = `UPDATE rooms
SET active_speakers_obj = active_speakers_obj + ? WHERE room_id = ? AND created_at = ?`;
exports.setActiveSpeakers = `UPDATE rooms
SET active_speakers_obj[?] = ? WHERE room_id= ? AND created_at = ?`;
exports.delActiveSpeaker = `DELETE active_speakers_obj[?] FROM rooms WHERE room_id= ? AND created_at = ?`;
exports.addMuteMap = `UPDATE rooms
SET muted_speakers_obj = muted_speakers_obj + ? WHERE room_id = ? AND created_at = ?`;
exports.setMuteMap = `UPDATE rooms
SET muted_speakers_obj[?] = ? WHERE room_id= ? AND created_at = ?`;
exports.delMuteMap = `DELETE muted_speakers_obj[?] FROM rooms WHERE room_id= ? AND created_at = ?`;
//# sourceMappingURL=otherRoomOp.js.map