const mongoose = require('mongoose');

const cardPreferenceSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    flag: { type: String, required: true },
}, {
    timestamps: true,
});

cardPreferenceSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('CardPreference', cardPreferenceSchema);
