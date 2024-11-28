const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
    guildId: String,
    userId: String,
    warnings: [
        {
            reason: String,
            timestamp: { type: Date, default: Date.now }, // Set default date to now
        },
    ],
});

module.exports = mongoose.model('Warning', warningSchema);
