const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
    guildId: String,
    userId: String,
    warnings: [
        {
            reason: String,
            timestamp: { type: Date, default: Date.now }, // Set default date to now
            issuerId: String,
            issuerTag: String,
            issuerRole: { type: String, enum: ['Admins', 'Proud Guardians'], default: 'Admins' },
        },
    ],
});

module.exports = mongoose.model('Warning', warningSchema);
