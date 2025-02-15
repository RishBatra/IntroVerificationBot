const mongoose = require('mongoose');

const videoEventSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  categoryId: { type: String, required: true },
  waitingRoomId: { type: String, required: true },
  videoChannelId: { type: String, required: true },
  videoTextChannelId: { type: String },
  videoVerifiedRoleId: { type: String, required: true },
  timeoutDuration: { type: Number, default: 10000 }, // Default timeout is 10 sec (in milliseconds)
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('VideoEvent', videoEventSchema);