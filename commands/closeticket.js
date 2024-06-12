const { SlashCommandBuilder } = require('discord.js');
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
        const reason = interaction.options.getString('reason');
        const channel = interaction.channel;

        const ticket = await Ticket.findOne({ channelId: channel.id });
        if (!ticket) {
            return interaction.reply({ content: 'No ticket found for this channel.', ephemeral: true });
        }

        const logChannel = interaction.guild.channels.cache.find(c => c.name === 'ticket-log');
        const transcriptChannel = interaction.guild.channels.cache.find(c => c.name === 'transcripts');

        const embed = new EmbedBuilder()
            .setTitle('Ticket Closed')
            .setDescription(`Reason: ${reason}`)
            .setColor(0x00AE86);

        await logChannel.send({ content: `Ticket closed by ${interaction.user.username}.`, embeds: [embed] });
        await transcriptChannel.send({ content: `Transcript for ticket opened by ${ticket.username}`, embeds: [embed] });

        await Ticket.deleteOne({ channelId: channel.id });
        await channel.delete();
        await interaction.reply({ content: 'Ticket closed and transcript sent.', ephemeral: true });
    }
};