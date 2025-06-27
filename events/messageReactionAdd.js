const { handleIntroReaction } = require('../handlers/introManagementHandler');

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user) {
        // Handle partial reactions
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Error fetching reaction:', error);
                return;
            }
        }

        // Handle partial messages
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (error) {
                console.error('Error fetching message:', error);
                return;
            }
        }

        await handleIntroReaction(reaction, user);
    },
}; 