const handleIntro = require('../handlers/introHandler');
const { handleTicket } = require('../handlers/ticketHandler');

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
                await handleIntro(message);
            }
        } else {
            await handleTicket(message);
        }
    },
};