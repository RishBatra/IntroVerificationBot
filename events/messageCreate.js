const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const Ticket = require('../models/ticket');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) {
            // Ignore messages from bots, unless it's a closing message
            if (message.content.toLowerCase().includes('ticket closed')) {
                // Handle ticket closing logic here
                console.log('Ticket closed:', message.content);
            }
            return;
        }

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
    }
}

async function handleDM(message) {
    console.log('Received a DM:', message.content);

    const ticket = await Ticket.findOne({ userId: message.author.id, status: 'open' });

    if (ticket) {
        // Forward the DM to the ticket channel
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
    } else {
        // If no open ticket, offer to create one
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
}

function handleError(error) {
    if (error.code === 50007) {
        console.error('Cannot send messages to this user:', error.message);
    } else {
        console.error('Error sending DM to user:', error);
    }
}

// function validateIntroMessage(content) {
//     const errors = [];
//     let isValid = true;

//     if (content.length < 50) {
//         errors.push('Your introduction should be at least 50 characters long.');
//         isValid = false;
//     }

//     const sentences = content.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
//     if (sentences.length < 3) {
//         errors.push('Your introduction should contain at least 3 sentences.');
//         isValid = false;
//     }

//     const keyWords = ['name', 'age', 'hobby', 'from'];
//     const missingInfo = keyWords.filter(word => !content.toLowerCase().includes(word));
//     if (missingInfo.length > 0) {
//         errors.push(`Please include information about your ${missingInfo.join(', ')}.`);
//         isValid = false;
//     }

//     return { isValid, errors };
// }