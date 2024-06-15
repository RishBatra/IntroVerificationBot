const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Check if the message is from a guild or a DM
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
    console.log('Received a DM:', message.content); // Debugging log

    const guild = message.client.guilds.cache.get(process.env.GUILD_ID); // Use your guild ID
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
        console.log('DM sent successfully.'); // Debugging log
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
    // Validation logic for intro messages
    const errors = [];
    const isValid = true; // Replace with actual validation logic

    return { isValid, errors };
}