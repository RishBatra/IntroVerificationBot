const { ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const Ticket = require('../models/ticket');

// ... existing code ...

async function handleTicketCreation(interaction) {
    if (interaction.customId === 'ticket_yes') {
        const embed = new EmbedBuilder()
            .setTitle('Select Ticket Type')
            .setDescription('What type of ticket do you want to create?')
            .setColor(0x00AE86);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_ticket_type')
                .setPlaceholder('Select a ticket type')
                .addOptions([
                    { label: 'Report someone', value: 'report_someone' },
                    { label: 'DM related', value: 'dm_related' },
                    { label: '18+ SFW Access', value: '18_sfw_access' },
                    { label: 'Selfies Access', value: 'selfies_access' },
                    { label: 'NSFW Access', value: 'nsfw_access' },
                    { label: 'Other', value: 'other' }
                ])
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    } else if (interaction.customId === 'ticket_no') {
        await interaction.reply({ content: 'Ticket creation cancelled.', ephemeral: true });
    }
}

async function handleTicketTypeSelection(interaction) {
    const ticketType = interaction.values[0];
    const guild = interaction.client.guilds.cache.get(process.env.GUILD_ID);
    const category = guild.channels.cache.find(c => c.name === 'talktomods' && c.type === ChannelType.GuildCategory);

    const channel = await guild.channels.create({
        name: `${interaction.user.username}-ticket`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: interaction.user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
            },
            {
                id: process.env.MOD_ROLE_ID,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
            }
        ]
    });

    await Ticket.create({
        userId: interaction.user.id,
        username: interaction.user.username,
        channelId: channel.id,
        type: ticketType
    });

    try {
        await interaction.user.send(`Your ticket has been created in the server. A moderator will assist you shortly.`);
    } catch (error) {
        console.error('Cannot send messages to this user:', error.message);
    }

    await interaction.reply({ content: `Ticket created successfully.`, ephemeral: true });

    const embed = new EmbedBuilder()
        .setTitle('New Ticket')
        .setDescription(`User: ${interaction.user.username}\nType: ${ticketType}`)
        .setColor(0x00AE86);

    await channel.send({ embeds: [embed] });
}

module.exports = {
    handleTicket,
    handleTicketCreation,
    handleTicketTypeSelection
};