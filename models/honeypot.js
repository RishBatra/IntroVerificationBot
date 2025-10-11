const mongoose = require('mongoose');

const honeypotSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    channelId: {
        type: String,
        required: true
    },
    channelName: {
        type: String,
        default: 'do-not-post'
    },
    enabled: {
        type: Boolean,
        default: true
    },
    bannedUsers: [{
        userId: String,
        username: String,
        bannedAt: {
            type: Date,
            default: Date.now
        },
        messageContent: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Honeypot', honeypotSchema);

