const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Ticket = require('../models/ticket');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('closeticket')
        .setDescription('Close a ticket')
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Reason for closing the ticket')
                .setRequired(true)),
    async execute(interaction) {
        try {
            const reason = interaction.options.getString('reason');
            const channel = interaction.channel;

            const ticket = await Ticket.findOne({ channelId: channel.id });
            if (!ticket) {
                return interaction.reply({ content: 'No ticket found for this channel.', ephemeral: true });
            }

            const logChannel = interaction.guild.channels.cache.find(c => c.name === 'ticket-log');
            const transcriptChannel = interaction.guild.channels.cache.find(c => c.name === 'transcripts');
            const user = await interaction.client.users.fetch(ticket.userId);

            const embed = new EmbedBuilder()
                .setTitle('Ticket Closed')
                .setDescription(`Reason: ${reason}`)
                .setColor(0x00AE86);

            if (logChannel) {
                await logChannel.send({ content: `Ticket closed by ${interaction.user.username}.`, embeds: [embed] });
            } else {
                console.error('Log channel not found');
            }

            if (transcriptChannel) {
                await transcriptChannel.send({ content: `Transcript for ticket opened by ${ticket.username}`, embeds: [embed] });
            } else {
                console.error('Transcript channel not found');
            }

            try {
                await user.send(`Your ticket in the server ${interaction.guild.name} has been closed. Reason: ${reason}`);
            } catch (error) {
                console.error('Cannot send messages to this user:', error.message);
            }

            await Ticket.deleteOne({ channelId: channel.id });
            await channel.delete();
            await interaction.reply({ content: 'Ticket closed and transcript sent.', ephemeral: true });
        } catch (error) {
            console.error('Error closing ticket:', error);
            await interaction.reply({ content: 'There was an error closing the ticket.', ephemeral: true });
        }
    }
};
