const mongoose = require('mongoose');

const selfieComplianceSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: false },
    flaggedAt: { type: Date, required: true },
    lastPostDateAtFlag: { type: Date, default: null },
    dmSentAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    clearedAt: { type: Date, default: null },
    clearReason: { type: String, default: null },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'warned', 'revoked', 'cleared'],
        default: 'pending',
        index: true
    }
}, {
    timestamps: true
});

selfieComplianceSchema.index({ guildId: 1, userId: 1, status: 1 });
selfieComplianceSchema.index({ status: 1, flaggedAt: 1 });

module.exports = mongoose.model('SelfieCompliance', selfieComplianceSchema);
