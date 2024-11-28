const VoiceTextChannelManager = require('../utils/voiceTextChannelManager');

let voiceTextChannelManager;

module.exports = {
    name: 'voiceStateUpdate',
    once: false,
    execute(oldState, newState) {
        if (!voiceTextChannelManager) {
            voiceTextChannelManager = new VoiceTextChannelManager(oldState.client);
        }

        handleVoiceStateUpdate(oldState, newState, voiceTextChannelManager);
    },
};

async function handleVoiceStateUpdate(oldState, newState, manager) {
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    const member = newState.member;

    // User joined a voice channel
    if (!oldChannel && newChannel) {
        await manager.updateTextChannelVisibility(newChannel, member, true);
    }
    // User left a voice channel
    else if (oldChannel && !newChannel) {
        await manager.updateTextChannelVisibility(oldChannel, member, false);
    }
    // User moved between voice channels
    else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
        await manager.updateTextChannelVisibility(oldChannel, member, false);
        await manager.updateTextChannelVisibility(newChannel, member, true);
    }
}