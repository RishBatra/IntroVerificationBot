const mongoose = require('mongoose');

const selfiePostSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        unique: true  // One record per user
    },
    username: { 
        type: String, 
        required: false  // For easy reference
    },
    lastPostDate: { 
        type: Date, 
        required: true,
        index: true  // Makes queries super fast
    },
    channelId: { 
        type: String, 
        required: true 
    },
    messageId: { 
        type: String, 
        required: false  // Reference to their last post
    },
    guildId: { 
        type: String, 
        required: true 
    }
}, {
    timestamps: true  // Adds createdAt and updatedAt automatically
});

// Index for fast queries by date
selfiePostSchema.index({ lastPostDate: 1 });
selfiePostSchema.index({ guildId: 1, lastPostDate: 1 });

module.exports = mongoose.model('SelfiePost', selfiePostSchema);

