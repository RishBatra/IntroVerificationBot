// File: commands/videocallevent.js
const { SlashCommandBuilder, ChannelType } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create-event')
        .setDescription('Creates the video event channels and role'),
    async execute(interaction) {
        try {
            // Defer the reply immediately so that Discord doesn’t mark the interaction as unknown.
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;

            // Create the "Video Enabled" role if it doesn't already exist.
            const videoRoleName = "Video Enabled";
            let videoRole = guild.roles.cache.find(r => r.name === videoRoleName);
            if (!videoRole) {
                videoRole = await guild.roles.create({
                    name: videoRoleName,
                    reason: "Needed for event access to the video channel",
                });
            }

            // Create a category to hold the event channels.
            const category = await guild.channels.create({
                name: 'Video Event Category',
                type: ChannelType.GuildCategory,
            });

            // Create the waiting room voice channel.
            const waitingRoom = await guild.channels.create({
                name: 'Waiting Room',
                type: ChannelType.GuildVoice,
                parent: category.id,
            });

            // Create the video call voice channel with permission overwrites:
            // - Deny everyone from viewing the channel.
            // - Allow members with the video role to view and connect.
            const videoChannel = await guild.channels.create({
                name: 'Video Call',
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['ViewChannel'],
                    },
                    {
                        id: videoRole.id,
                        allow: ['ViewChannel', 'Connect', 'Speak', 'Stream'],
                    },
                ],
            });

            // Save event details to your database.
            const eventData = new VideoEvent({
                guildId: guild.id,
                categoryId: category.id,
                waitingRoomId: waitingRoom.id,
                videoChannelId: videoChannel.id,
            });
            await eventData.save();

            // Finally, edit the deferred reply with success information.
            await interaction.editReply({
                content: `✅ Event created successfully!
Waiting Room: <#${waitingRoom.id}>
Video Call: <#${videoChannel.id}>`
            });
        } catch (error) {
            console.error("Event Creation Error:", error);
            // If the interaction was deferred or already replied to, use editReply.
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ There was an error creating the event.'
                });
            } else {
                await interaction.reply({
                    content: '❌ There was an error creating the event.',
                    ephemeral: true
                });
            }
        }
    }
};
