const mongoose = require('mongoose');

const voiceSessionSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    joinedAt: { type: Date, required: true },
    leftAt: { type: Date, required: true },
    durationMs: { type: Number, required: true }
}, { 
    timestamps: true,
    minimize: false 
});

// Compound index for efficient aggregation queries
voiceSessionSchema.index({ guildId: 1, userId: 1 });

// Index for querying by guild and time range
voiceSessionSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('VoiceSession', voiceSessionSchema);

