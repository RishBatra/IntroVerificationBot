const mongoose = require('mongoose');

const videoEventSchema = new mongoose.Schema({
  guildId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  categoryId: String,
  waitingRoomId: String,
  videoChannelId: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('VideoEvent', videoEventSchema);
