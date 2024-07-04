const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    userId: String,
    username: String,
    channelId: String,
    type: String,
    status: { type: String, default: 'open' },
    assignedMod: String,
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Ticket', ticketSchema);
