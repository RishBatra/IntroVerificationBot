const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const Honeypot = require('../models/honeypot');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setuphoneypot')
        .setDescription('Setup a honeypot channel that bans anyone who posts in it')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to use as honeypot (will create if not specified)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('verified_role')
                .setDescription('Name of the verified role (users with this role can see the channel)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;
            let channel = interaction.options.getChannel('channel');
            const verifiedRoleName = interaction.options.getString('verified_role') || 'Verified';

            // Find or create the verified role
            let verifiedRole = guild.roles.cache.find(r => r.name === verifiedRoleName);
            if (!verifiedRole) {
                return await interaction.editReply(`❌ Could not find role: **${verifiedRoleName}**. Please specify the correct verified role name.`);
            }

            // Create channel if not specified
            if (!channel) {
                channel = await guild.channels.create({
                    name: 'do-not-post',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: guild.id, // @everyone role
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: verifiedRole.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.SendMessages // Allow posting - that's the trap!
                            ]
                        }
                    ]
                });
            } else {
                // Update permissions on existing channel
                await channel.permissionOverwrites.set([
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: verifiedRole.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.SendMessages // Allow posting - that's the trap!
                        ]
                    }
                ]);
            }

            // Save to database
            await Honeypot.findOneAndUpdate(
                { guildId: guild.id },
                {
                    guildId: guild.id,
                    channelId: channel.id,
                    channelName: channel.name,
                    enabled: true
                },
                { upsert: true, new: true }
            );

            // Send the warning message to the channel
            const warningEmbed = new EmbedBuilder()
                .setTitle('🚨 DO NOT POST HERE 🚨')
                .setDescription('Not even as a joke. Not even for fun. This channel is a **honeypot for compromised accounts**. If you post something here, you **WILL BE BANNED**. If you post something here as a "joke", your appeal **WILL BE DENIED**.')
                .addFields(
                    { name: '⚠️ This is your only warning.', value: '\u200B' }
                )
                .setColor('#FF0000')
                .setTimestamp();

            await channel.send({ embeds: [warningEmbed] });

            // Pin the message
            const messages = await channel.messages.fetch({ limit: 1 });
            const lastMessage = messages.first();
            if (lastMessage) {
                await lastMessage.pin();
            }

            // Confirmation
            const confirmEmbed = new EmbedBuilder()
                .setTitle('✅ Honeypot Setup Complete')
                .setDescription(`Honeypot channel has been configured successfully!`)
                .addFields(
                    { name: '📢 Channel', value: `${channel}`, inline: true },
                    { name: '🎭 Visible to', value: `${verifiedRole}`, inline: true },
                    { name: '⚡ Status', value: 'Active', inline: true },
                    { name: '🛡️ Protection', value: 'Anyone who posts (except admins/mods) will be **immediately banned**' }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('Error setting up honeypot:', error);
            await interaction.editReply(`❌ Error setting up honeypot: ${error.message}`);
        }
    },
};

