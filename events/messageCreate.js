const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const Ticket = require('../models/ticket');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.guild) {
            handleGuildMessage(message);
        } else {
            handleDM(message);
        }
    },
};

async function handleGuildMessage(message) {
    if (message.channel.name === 'intros') {
        const { isValid, errors } = validateIntroMessage(message.content);

        if (!isValid) {
            await message.reply(`Please correct your introduction:\n${errors.join('\n')}`);
        } else {
            // Handle valid introductions if needed
        }
    } else if (message.channel.parent && message.channel.parent.name === 'talktomods') {
        // Check if the message is from an admin in a ticket channel
        if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const ticket = await Ticket.findOne({ channelId: message.channel.id });
            if (ticket) {
                const user = await message.client.users.fetch(ticket.userId);
                try {
                    await user.send(`An admin responded to your ticket: ${message.content}`);
                } catch (error) {
                    console.error('Cannot send messages to this user:', error.message);
                }
            }
        }
    }
}

async function handleDM(message) {
    console.log('Received a DM:', message.content);

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

function handleError(error) {
    if (error.code === 50007) {
        console.error('Cannot send messages to this user:', error.message);
    } else {
        console.error('Error sending DM to user:', error);
    }
}

function validateIntroMessage(content) {
    const errors = [];
    let isValid = true;

    // Check if the message is at least 50 characters long
    if (content.length < 50) {
        errors.push('Your introduction should be at least 50 characters long.');
        isValid = false;
    }

    // Check if the message contains at least 3 sentences
    const sentences = content.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
    if (sentences.length < 3) {
        errors.push('Your introduction should contain at least 3 sentences.');
        isValid = false;
    }

    // Check if the message includes some key information (you can customize this)
    const keyWords = ['name', 'age', 'hobby', 'from'];
    const missingInfo = keyWords.filter(word => !content.toLowerCase().includes(word));
    if (missingInfo.length > 0) {
        errors.push(`Please include information about your ${missingInfo.join(', ')}.`);
        isValid = false;
    }

    return { isValid, errors };
}