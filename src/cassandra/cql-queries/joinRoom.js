"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = `INSERT INTO 
user_in_room_by_room_id(
  room_id, 
  created_at, 
  user_id, 
  user_name,
  photo_url, 
  room_permisions
  ) 
VALUES(?, ?, ?, ?, ?, ?)`;
//# sourceMappingURL=joinRoom.js.map