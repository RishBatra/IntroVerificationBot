const { handleIntroReaction } = require('../handlers/introManagementHandler');

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user) {
        console.log(`[REACTION EVENT] Reaction event triggered!`);
        console.log(`[REACTION EVENT] Emoji: ${reaction.emoji.name}`);
        console.log(`[REACTION EVENT] User: ${user.tag} (${user.id})`);
        console.log(`[REACTION EVENT] Message ID: ${reaction.message.id}`);
        console.log(`[REACTION EVENT] Channel: ${reaction.message.channel.name}`);
        console.log(`[REACTION EVENT] Guild: ${reaction.message.guild.name}`);
        
        // Handle partial reactions
        if (reaction.partial) {
            console.log(`[REACTION EVENT] Fetching partial reaction...`);
            try {
                await reaction.fetch();
                console.log(`[REACTION EVENT] ✅ Successfully fetched partial reaction`);
            } catch (error) {
                console.error('[REACTION EVENT] ❌ Error fetching reaction:', error);
                return;
            }
        }

        // Handle partial messages
        if (reaction.message.partial) {
            console.log(`[REACTION EVENT] Fetching partial message...`);
            try {
                await reaction.message.fetch();
                console.log(`[REACTION EVENT] ✅ Successfully fetched partial message`);
            } catch (error) {
                console.error('[REACTION EVENT] ❌ Error fetching message:', error);
                return;
            }
        }

        console.log(`[REACTION EVENT] Calling handleIntroReaction...`);
        await handleIntroReaction(reaction, user);
        console.log(`[REACTION EVENT] Finished processing reaction`);
    },
}; 