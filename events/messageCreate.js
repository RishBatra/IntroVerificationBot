const { EmbedBuilder } = require('discord.js');
const Ticket = require('../models/ticket');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.guild) {
            // Handle guild messages
            if (message.channel.name === 'intros') {
                const { isValid, errors } = validateIntroMessage(message.content);
                
                if (!isValid) {
                    await message.reply(`Please correct your introduction:\n${errors.join('\n')}`);
                } else {
                    // Handle valid introductions if needed
                }
            }

            // Assign ticket to mod on first reply
            if (message.channel.name.includes('-ticket') && !message.author.bot) {
                const ticket = await Ticket.findOne({ channelId: message.channel.id });
                if (ticket && !ticket.assignedMod) {
                    ticket.assignedMod = message.author.username;
                    await ticket.save();

                    const logChannel = message.guild.channels.cache.find(c => c.name === 'ticket-log');
                    if (logChannel) {
                        await logChannel.send(`Ticket in ${message.channel.name} has been assigned to ${message.author.username}.`);
                    }

                    await message.channel.send(`This ticket is now assigned to ${message.author.username}.`);
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
            } catch (error) {
                if (error.code === 50007) {
                    console.error('Cannot send messages to this user:', error.message);
                } else {
                    console.error('Error sending DM to user:', error);
                }
            }
        }
    }
};
