"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = `INSERT INTO rooms(
  room_id, 
  created_by_id, 
  about_room, 
  isPublic, 
  room_name, 
  active_speakers_obj, 
  muted_speakers_obj, 
  block_speakers_obj, 
  created_at
  ) 
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
//# sourceMappingURL=createRoom.js.map