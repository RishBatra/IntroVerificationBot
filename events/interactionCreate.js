const { Events, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, SelectMenuBuilder } = require('discord.js');
const Ticket = require('../models/ticket');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}`);
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isButton()) {
            if (interaction.customId === 'ticket_yes') {
                const embed = new EmbedBuilder()
                    .setTitle('Select Ticket Type')
                    .setDescription('What type of ticket do you want to create?')
                    .setColor(0x00AE86);

                const row = new ActionRowBuilder().addComponents(
                    new SelectMenuBuilder()
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
        } else if (interaction.isSelectMenu()) {
            if (interaction.customId === 'select_ticket_type') {
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
                            id: process.env.MOD_ROLE_ID, // Use your mod role ID
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

                await interaction.reply({ content: `Ticket created in ${channel}.`, ephemeral: true });

                const embed = new EmbedBuilder()
                    .setTitle('New Ticket')
                    .setDescription(`User: ${interaction.user.username}\nType: ${ticketType}`)
                    .setColor(0x00AE86);

                await channel.send({ embeds: [embed] });
            }
        }
    }
};
