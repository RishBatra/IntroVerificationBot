const mongoose = require('mongoose');

const introEditWindowSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: {
        type: String,
        required: true,
        enum: ['active', 'expired', 'ended'],
        default: 'active'
    },
    startedBy: { type: String, default: null },
    endedBy: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

introEditWindowSchema.index({ guildId: 1, userId: 1 }, { unique: true });
introEditWindowSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('IntroEditWindow', introEditWindowSchema);
