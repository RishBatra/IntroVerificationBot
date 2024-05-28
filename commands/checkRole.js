const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkrole')
        .setDescription('Checks if a user has any role other than Verified')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to check')
                .setRequired(true)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        const member = await interaction.guild.members.fetch(targetUser.id);
        
        // Find the "Verified" role by name
        const verifiedRole = interaction.guild.roles.cache.find(role => role.name === 'Verified');
        
        if (!verifiedRole) {
            return interaction.reply('Verified role not found in this server.');
        }

        // Fetch the member to ensure roles are up-to-date
        await member.fetch();

        // Check if the member has any roles other than "Verified" and "@everyone"
        const otherRoles = member.roles.cache.filter(role => role.id !== verifiedRole.id && role.id !== interaction.guild.id);

        if (otherRoles.size > 0) {
            await interaction.reply(`${targetUser.username} has roles other than Verified.`);
        } else {
            // Ask for confirmation to send a message
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm')
                        .setLabel('Yes')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('cancel')
                        .setLabel('No')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.reply({ content: `${targetUser.username} only has the Verified role. Do you want to send a message?`, components: [row] });

            const filter = i => i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

            collector.on('collect', async i => {
                if (i.customId === 'confirm') {
                    await i.update({ content: 'Please mention the channel to send the message to.', components: [] });

                    const channelFilter = response => response.author.id === interaction.user.id;
                    const channelCollector = interaction.channel.createMessageCollector({ filter: channelFilter, time: 15000 });

                    channelCollector.on('collect', async response => {
                        const channel = response.mentions.channels.first();
                        if (channel && channel.type === ChannelType.GuildText) {
                            const embed = new EmbedBuilder()
                                .setColor(0x0099FF)
                                .setTitle('Role Reminder')
                                .setDescription(`Hey ${targetUser}, please pick your roles within the next 24 hours to slay with us, or we might have to say goodbye! 🌈`)
                                .setTimestamp()
                                .setFooter({ text: 'LGBTQIndiA' });

                            await channel.send({ embeds: [embed] });
                            await response.reply('Message sent successfully.');
                        } else {
                            await response.reply('Invalid channel. Please mention a text channel.');
                        }
                        channelCollector.stop();
                    });

                    channelCollector.on('end', collected => {
                        if (collected.size === 0) {
                            interaction.followUp('No channel mentioned. Action cancelled.');
                        }
                    });
                } else if (i.customId === 'cancel') {
                    await i.update({ content: 'Action cancelled.', components: [] });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({ content: 'No response received. Action cancelled.', components: [] });
                }
            });
        }
    },
};
