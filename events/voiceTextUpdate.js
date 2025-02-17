module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        // Ignore bot updates
        if (newState.member.user.bot) return;

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
    }
};