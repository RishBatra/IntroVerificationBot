const { Events } = require('discord.js');
const { handleTicketCreation, handleTicketTypeSelection } = require('../handlers/ticketHandler');
const Ticket = require('../models/ticket');
const requestAccessCommand = require('../commands/requestaccess');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}`);
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('ticket_')) {
                await handleTicketCreation(interaction);
            } else {
                await requestAccessCommand.buttonHandler(interaction);
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'select_ticket_type') {
                await handleTicketTypeSelection(interaction);
            }
        } else if (interaction.isModalSubmit()) {
            await requestAccessCommand.modalHandler(interaction);
        }
    },
};

module.exports.messageCreate = async (message) => {
    if (message.channel.type === 'DM' && !message.author.bot) {
        console.log(`Received message: "${message.content}" in channel type: ${message.channel.type}`);
        await handleTicket(message);
    } else if (message.channel.type === 'GUILD_TEXT' && !message.author.bot) {
        const ticket = await Ticket.findOne({ channelId: message.channel.id, status: 'open' });
        if (ticket) {
            const user = await message.client.users.fetch(ticket.userId);
            if (user) {
                try {
                    await user.send(`Mod response in ticket: ${message.content}`);
                } catch (error) {
                    console.error('Error sending message to user:', error);
                }
            }
        }
    }
};