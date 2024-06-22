const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const Ticket = require('../models/ticket');

async function handleTicket(message) {
    console.log('handleTicket called');
    try {
        const ticket = await Ticket.findOne({ userId: message.author.id, status: 'open' });
        console.log('Ticket search result:', ticket);

        if (ticket) {
            console.log('Existing ticket found, forwarding DM to ticket');
            await forwardDMToTicket(message, ticket);
        } else {
            console.log('No existing ticket, offering to create one');
            await offerToCreateTicket(message);
        }
    } catch (error) {
        console.error('Error in handleTicket:', error);
    }
}

async function forwardDMToTicket(message, ticket) {
    console.log('forwardDMToTicket called');
    const guild = message.client.guilds.cache.get(process.env.GUILD_ID);
    console.log('Guild:', guild ? guild.name : 'Not found');
    const ticketChannel = guild.channels.cache.get(ticket.channelId);
    console.log('Ticket channel:', ticketChannel ? ticketChannel.name : 'Not found');

    if (ticketChannel) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(message.content)
            .setColor(0x00AE86)
            .setTimestamp();

        await ticketChannel.send({ embeds: [embed] });
        console.log('Message forwarded to ticket channel');
    } else {
        console.log('Ticket channel not found');
    }
}

async function offerToCreateTicket(message) {
    console.log('offerToCreateTicket called');
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
    console.log('handleTicketCreation called');
    const guild = interaction.guild;
    const category = guild.channels.cache.find(c => c.name == "Tickets" && c.type == ChannelType.GuildCategory);
    if (!category) return interaction.reply({ content: 'Ticket category channel does not exist!', ephemeral: true });

    const ticketChannel = await guild.channels.create(`ticket-${interaction.user.username}`, {
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
                id: interaction.user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
            },
        ],
    });

    await ticketChannel.send(`Welcome ${interaction.user}, a team member will assist you shortly.`);
    interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
}

async function handleTicketTypeSelection(interaction) {
    console.log('handleTicketTypeSelection called');
    const selectedValue = interaction.values[0];
    await interaction.reply({ content: `You selected: ${selectedValue}`, ephemeral: true });
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
