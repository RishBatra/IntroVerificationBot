const { handleTicket } = require('../handlers/ticketHandler');
const { handleIntro } = require('../handlers/introHandler');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        console.log(`Received message: "${message.content}" in channel type: ${message.channel.type}`);

        // Ignore bot messages, except for ticket closure notifications
        if (message.author.bot) {
            if (message.content.toLowerCase().includes('ticket closed')) {
                console.log('Ticket closed:', message.content);
            } else {
                console.log('Ignoring bot message');
            }
            return;
        }

        // Handle messages in guilds (servers)
        if (message.guild) {
            console.log('Message is in a guild');
            
            // Handle intro messages
            if (message.channel.name === 'intros-test') {
                console.log('Message is in intros channel, handling introduction');
                try {
                    await handleIntro(message);
                } catch (error) {
                    console.error('Error handling intro:', error);
                }
            }

            // Add any other guild-specific message handling here
        } 
        // Handle direct messages (for ticket system)
        else {
            console.log('Message is not in a guild, calling handleTicket');
            try {
                await handleTicket(message);
            } catch (error) {
                console.error('Error in handleTicket:', error);
            }
        }

        // Add any global message handling here (applies to both guild and DM messages)
    },
};