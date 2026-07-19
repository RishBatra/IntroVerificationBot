const { Events } = require('discord.js');
const Queue = require('../models/queue');
const queueManager = require('../utils/queueManager');

// Refresh all live queue displays on startup so they reflect the current
// state and their buttons keep working (buttons are routed by customId,
// so no collectors need to be re-attached).
module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        try {
            const queues = await Queue.find({ displayMessageId: { $ne: null } });
            for (const queue of queues) {
                await queueManager.refreshDisplay(client, queue._id).catch(error => {
                    console.error(`[queueDisplayReady] Failed to refresh display for queue "${queue.name}":`, error);
                });
            }
            if (queues.length > 0) {
                console.log(`[queueDisplayReady] Refreshed ${queues.length} queue display(s).`);
            }
        } catch (error) {
            console.error('[queueDisplayReady] Failed to rehydrate queue displays:', error);
        }
    }
};
