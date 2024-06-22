const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, StringSelectMenuBuilder } = require('discord.js');
const Ticket = require('../models/ticket');

async function handleTicket(message) {
    const ticket = await Ticket.findOne({ userId: message.author.id, status: 'open' });

    if (ticket) {
        await forwardDMToTicket(message, ticket);
    } else {
        await offerToCreateTicket(message);
    }
}

async function forwardDMToTicket(message, ticket) {
    const guild = message.client.guilds.cache.get(process.env.GUILD_ID);
    const ticketChannel = guild.channels.cache.get(ticket.channelId);

    if (ticketChannel) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(message.content)
            .setColor(0x00AE86)
            .setTimestamp();

        await ticketChannel.send({ embeds: [embed] });
    }
}

async function offerToCreateTicket(message) {
    const guild = message.client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
        console.error('Guild not found. Please check your GUILD_ID.');
        return;
    }

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

    try {
        await message.author.send({ embeds: [embed], components: [row] });
        console.log('DM sent successfully.');
    } catch (error) {
        handleError(error);
    }
}

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

function handleError(error) {
    if (error.code === 50007) {
        console.error('Cannot send messages to this user:', error.message);
    } else {
        console.error('Error sending DM to user:', error);
    }
}

module.exports = {
    handleTicket,
    handleTicketCreation,
    handleTicketTypeSelection
};