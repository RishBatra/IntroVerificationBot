const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-event')
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
            // Create category
            const category = await guild.channels.create({
                name: 'Video Events',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [{
                    id: guild.id,
                    deny: [PermissionFlagsBits.Connect]
                }]
            });

            // Create waiting room
            const waitingRoom = await guild.channels.create({
                name: '🚪-waiting-room',
                type: ChannelType.GuildVoice,
                parent: category,
                permissionOverwrites: [{
                    id: guild.id,
                    deny: [PermissionFlagsBits.Speak]
                }]
            });

            // Create video channel
            const videoChannel = await guild.channels.create({
                name: '📹-video-call',
                type: ChannelType.GuildVoice,
                parent: category,
                permissionOverwrites: [{
                    id: guild.id,
                    deny: [PermissionFlagsBits.Connect]
                }]
            });

            // Save to database
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
            console.error(error);
            await interaction.reply({
                content: '❌ Failed to create event channels!',
                ephemeral: true
            });
        }
    }
};
