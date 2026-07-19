const mongoose = require('mongoose');

const selfieComplianceConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    lastScanAt: { type: Date, default: null }
}, {
    timestamps: true
});

module.exports = mongoose.model('SelfieComplianceConfig', selfieComplianceConfigSchema);
