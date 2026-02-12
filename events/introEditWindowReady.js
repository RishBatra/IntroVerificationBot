const { Events } = require('discord.js');
const { rehydrateIntroEditWindows } = require('../utils/introEditAccessService');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        try {
            await rehydrateIntroEditWindows(client);
            console.log('[introEditWindowReady] Rehydrated intro edit windows from database.');
        } catch (error) {
            console.error('[introEditWindowReady] Failed to rehydrate intro edit windows:', error);
        }
    }
};
