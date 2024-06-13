const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        console.log('Message received:', message.content); // Debugging log
        
        // Check if the message is from a guild or a DM
        if (message.guild) {
            // Handle guild messages here (e.g., intro validation)
            if (message.channel.name === 'intros') {
                const { isValid, errors } = validateIntroMessage(message.content);
                
                if (!isValid) {
                    console.log('Invalid intro message:', errors); // Debugging log
                    await message.reply(`Please correct your introduction:\n${errors.join('\n')}`);
                } else {
                    console.log('Valid intro message received.'); // Debugging log
                    // Handle valid introductions if needed
                }
            }
        } else {
            // Handle DMs
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
                if (error.code === 50007) {
                    console.error('Cannot send messages to this user:', error.message);
                } else {
                    console.error('Error sending DM to user:', error);
                }
            }
        }
    },
};
