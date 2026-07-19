const mongoose = require('mongoose');

const queueMemberSchema = new mongoose.Schema({
    queueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue', required: true },
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    // Higher priority is pulled first; ties broken by joinedAt (oldest first)
    priority: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
});

// Prevent double-joining the same queue
queueMemberSchema.index({ queueId: 1, userId: 1 }, { unique: true });
queueMemberSchema.index({ queueId: 1, priority: -1, joinedAt: 1 });

module.exports = mongoose.model('QueueMember', queueMemberSchema);
