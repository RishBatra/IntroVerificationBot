const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    // Map of epochDay (string) -> message count for that day
    buckets: { type: Map, of: Number, default: {} },
    updatedAt: { type: Date, default: Date.now }
}, { minimize: true });

userActivitySchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('UserActivity', userActivitySchema);


