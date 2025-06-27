const mongoose = require('mongoose');

const introSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    status: { 
        type: String, 
        required: true, 
        enum: ['pending', 'started', 'hold', 'denied'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
    holdUntil: { type: Date, default: null },
    lastReminderSent: { type: Date, default: null }
});

// Index for efficient queries
introSchema.index({ status: 1, createdAt: 1 });
introSchema.index({ status: 1, holdUntil: 1 });

module.exports = mongoose.model('Intro', introSchema); 