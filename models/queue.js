const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    // Channel + message of the live queue display embed
    displayChannelId: { type: String, default: null },
    displayMessageId: { type: String, default: null },
    // Max number of members allowed in the queue (null = unlimited)
    size: { type: Number, default: null },
    // Karaoke rotation: pulled members are re-added to the back instead of removed
    rotation: { type: Boolean, default: false },
    // Linked voice channel: members connected to it may pull (in addition to admins)
    voiceChannelId: { type: String, default: null },
    // Message template sent when a member is pulled. {user} is replaced with a mention.
    pullMessage: { type: String, default: null },
    // Last member pulled (shown as "Now up" on the display)
    lastPulledUserId: { type: String, default: null },
    locked: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

queueSchema.index({ guildId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Queue', queueSchema);
