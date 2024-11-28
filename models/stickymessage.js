const mongoose = require('mongoose');

const stickyMessageSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  message: { type: String, required: true },
  color: { type: String, default: '#0099ff' },
  lastMessageId: { type: String, default: null }
});

module.exports = mongoose.model('StickyMessage', stickyMessageSchema);
