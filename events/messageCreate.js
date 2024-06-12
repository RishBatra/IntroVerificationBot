const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const Ticket = require('../models/ticket');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.guild) return; // Only handle DMs

        const guild = message.client.guilds.cache.get(process.env.GUILD_ID); // Use your guild ID
        const serverAvatar = guild.iconURL();

        const embed = new EmbedBuilder()
            .setTitle(`Open a ticket in ${guild.name}`)
            .setDescription('Do you want to open a ticket?')
            .setThumbnail(serverAvatar)
            .setColor(0x00AE86);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_yes')
                .setLabel('✅ Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ticket_no')
                .setLabel('❌ No')
                .setStyle(ButtonStyle.Danger)
        );

        await message.author.send({ embeds: [embed], components: [row] });
    },
};
