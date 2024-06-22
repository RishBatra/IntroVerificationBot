const introHandler = require('../handlers/introHandler');
const ticketHandler = require('../handlers/ticketHandler');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) {
            if (message.content.toLowerCase().includes('ticket closed')) {
                console.log('Ticket closed:', message.content);
            }
            return;
        }

        if (message.guild) {
            if (message.channel.name === 'intros') {
                await introHandler(message);
            }
        } else {
            await ticketHandler(message);
        }
    },
};