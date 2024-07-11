const TARGET_USER_ID = '615016296693628931'; // Replace with the actual user ID you want to kick

module.exports = {
    name: 'voiceStateUpdate',
    execute(oldState, newState) {
        // Check if the user who joined the voice channel is the target user
        if (newState.id === TARGET_USER_ID && newState.channel) {
            try {
                // Kick the user from the voice channel
                newState.disconnect();
                console.log(`Kicked user ${TARGET_USER_ID} from the voice channel.`);
            } catch (error) {
                console.error(`Failed to kick user ${TARGET_USER_ID}:`, error);
            }
        }
    },
};