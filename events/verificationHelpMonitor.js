module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(message, client) {
        // Skip messages from bots
        if (message.author.bot) return;

        // Configuration - replace with your actual IDs
        const VERIFICATION_HELP_CHANNEL_ID = '1242333346131087420';
        const INTRO_CHANNEL_ID = '692965776545546261';
        const WAITING_FOR_VERIFICATION_ROLE_ID = '692985716040532011';
        const MOD_ROLE_ID = '800053595881078784';

        // Check if message is in the verification help channel
        if (message.channel.id !== VERIFICATION_HELP_CHANNEL_ID) return;

        // Allow mods to post in the channel
        if (message.member.roles.cache.has(MOD_ROLE_ID)) return;

        // Check if user has the waiting for verification role
        if (!message.member.roles.cache.has(WAITING_FOR_VERIFICATION_ROLE_ID)) return;

        // Check if message appears to be an intro by looking for common intro patterns
        const messageContent = message.content.toLowerCase();
        const introIndicators = [
            'age:',
            'gender:',
            'pronouns:',
            'orientation:',
            'location:'
        ];

        // Count how many intro indicators are in the message
        const matchCount = introIndicators.filter(indicator => 
            messageContent.includes(indicator)
        ).length;

        // If at least 3 indicators are present, likely an intro post
        if (matchCount >= 3) {
            try {
                // Get the intro channel
                const introChannel = await message.guild.channels.fetch(INTRO_CHANNEL_ID);
                
                // Delete message (if bot has permissions)
                await message.delete().catch(err => console.error('Failed to delete message:', err));
                
                // Send a message in the verification help channel
                await message.channel.send({
                    content: `${message.author}, please post your introduction in the ${introChannel} channel instead of here. This channel is for verification help only.`
                });
            } catch (error) {
                console.error('Error handling misplaced intro:', error);
            }
        }
    },
};