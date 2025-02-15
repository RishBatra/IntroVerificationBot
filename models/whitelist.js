const mongoose = require('mongoose');

const WhitelistSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true, unique: true },
});

module.exports = mongoose.model('Whitelist', WhitelistSchema);