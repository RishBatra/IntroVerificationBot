const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-video-event')
        .setDescription('Create video call event channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        const guild = interaction.guild;

        // Check existing event
        const existingEvent = await VideoEvent.findOne({ guildId: guild.id });
        if (existingEvent) {
            return interaction.reply({
                content: '❌ Event already exists! Use `/cleanup-event` first.',
                ephemeral: true
            });
        }

        try {
            // Create category with proper permissions
            const category = await guild.channels.create({
                name: 'Video Events',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect]
                    },
                    {
                        id: interaction.client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.MoveMembers
                        ]
                    }
                ]
            });

            // Create waiting room with speak permissions
            const waitingRoom = await guild.channels.create({
                name: '🚪-waiting-room',
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.Speak]
                    }
                ]
            });

            // Create video channel with strict permissions
            const videoChannel = await guild.channels.create({
                name: '📹-video-call',
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect]
                    },
                    {
                        id: interaction.client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.MoveMembers
                        ]
                    }
                ]
            });

            // Save to database with proper field names
            await VideoEvent.create({
                guildId: guild.id,
                categoryId: category.id,
                waitingRoomId: waitingRoom.id,
                videoChannelId: videoChannel.id
            });

            await interaction.reply({
                content: `✅ Event channels created!\nCategory: ${category}\nWaiting Room: ${waitingRoom}\nVideo Channel: ${videoChannel}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Event Creation Error:', error);
            await interaction.reply({
                content: '❌ Failed to create event channels! Check bot permissions.',
                ephemeral: true
            });
        }
    }
};
