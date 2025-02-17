const VideoEvent = require('../models/videocallevent');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        try {
            // Ignore bot updates
            if (newState.member.user.bot) return;

            // Check if this is a video event channel
            const videoEvent = await VideoEvent.findOne({ guildId: newState.guild.id });
            if (videoEvent) {
                const isOldChannelVideo = oldState.channel && [videoEvent.waitingRoomId, videoEvent.videoChannelId].includes(oldState.channelId);
                const isNewChannelVideo = newState.channel && [videoEvent.waitingRoomId, videoEvent.videoChannelId].includes(newState.channelId);
                
                // Skip if either channel is a video event channel
                if (isOldChannelVideo || isNewChannelVideo) return;
            }

            const voiceTextManager = newState.client.voiceTextManager;
            if (!voiceTextManager) return;

            // Handle member leaving a voice channel
            if (oldState.channel && oldState.channel !== newState.channel) {
                console.log(`[VoiceTextUpdate] Member ${oldState.member.user.tag} left ${oldState.channel.name}`);
                await voiceTextManager.updateTextChannelVisibility(
                    oldState.channel,
                    oldState.member,
                    false
                );
            }

            // Handle member joining a voice channel
            if (newState.channel && oldState.channel !== newState.channel) {
                console.log(`[VoiceTextUpdate] Member ${newState.member.user.tag} joined ${newState.channel.name}`);
                await voiceTextManager.updateTextChannelVisibility(
                    newState.channel,
                    newState.member,
                    true
                );
            }
        } catch (error) {
            console.error('[VoiceTextUpdate] Error:', error);
        }
    }
};