module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        console.log('[VoiceTextUpdate] Voice state change detected');
        
        // Ignore bot voice state changes
        if (newState.member.user.bot) {
            console.log('[VoiceTextUpdate] Ignoring bot voice state change');
            return;
        }

        const voiceTextManager = newState.client.voiceTextManager;
        if (!voiceTextManager) {
            console.error('[VoiceTextUpdate] VoiceTextManager not found!');
            return;
        }

        // Member joined a voice channel
        if (newState.channel && (!oldState.channel || oldState.channel.id !== newState.channel.id)) {
            console.log(`[VoiceTextUpdate] Member ${newState.member.user.tag} joined ${newState.channel.name}`);
            await voiceTextManager.updateTextChannelVisibility(newState.channel, newState.member, true);
        }
        
        // Member left a voice channel
        if (oldState.channel && (!newState.channel || oldState.channel.id !== newState.channel.id)) {
            console.log(`[VoiceTextUpdate] Member ${oldState.member.user.tag} left ${oldState.channel.name}`);
            await voiceTextManager.updateTextChannelVisibility(oldState.channel, oldState.member, false);
        }
    },
};