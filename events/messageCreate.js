const handleIntro = require('../handlers/introHandler');
const { handleTicket } = require('../handlers/ticketHandler');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        console.log(`Received message: "${message.content}" in channel type: ${message.channel.type}`);

        if (message.author.bot) {
            if (message.content.toLowerCase().includes('ticket closed')) {
                console.log('Ticket closed:', message.content);
            }
            console.log('Ignoring bot message');
            return;
        }

        if (message.guild) {
            console.log('Message is in a guild');
            if (message.channel.name === 'intros') {
                console.log('Message is in intros channel, calling handleIntro');
                await handleIntro(message);
            }
        } else {
            console.log('Message is not in a guild, calling handleTicket');
            try {
                await handleTicket(message);
            } catch (error) {
                console.error('Error in handleTicket:', error);
            }
        }
    },
};
