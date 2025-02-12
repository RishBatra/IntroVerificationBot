const mongoose = require('mongoose');

const videoEventSchema = new mongoose.Schema({
  guildId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  categoryId: { 
    type: String, 
    required: true 
  },
  waitingRoomId: { 
    type: String, 
    required: true 
  },
  videoChannelId: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('VideoEvent', videoEventSchema);