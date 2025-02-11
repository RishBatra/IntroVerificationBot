// File: commands/cleanupevent.js
const { SlashCommandBuilder } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup-event')
        .setDescription('Remove video event channels and clean up event roles'),
    async execute(interaction) {
        try {
            // Defer the reply immediately.
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const eventData = await VideoEvent.findOne({ guildId: guild.id });
            if (!eventData) {
                return await interaction.editReply({
                    content: '❌ No active event to clean up!'
                });
            }

            // Get and delete the event channels (waiting room, video call, and category).
            const channels = [
                guild.channels.cache.get(eventData.waitingRoomId),
                guild.channels.cache.get(eventData.videoChannelId),
                guild.channels.cache.get(eventData.categoryId)
            ].filter(c => c);

            for (const channel of channels) {
                await channel.delete().catch(console.error);
            }

            // Delete the "Video Enabled" role if it exists.
            const videoRole = guild.roles.cache.find(r => r.name === "Video Enabled");
            if (videoRole) {
                await videoRole.delete("Cleaning up event roles").catch(console.error);
            }

            // Remove the event record from your database.
            await VideoEvent.deleteOne({ guildId: guild.id });

            await interaction.editReply({
                content: '✅ Successfully cleaned up all event channels and roles!'
            });
        } catch (error) {
            console.error("Error during cleanup:", error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ Failed to clean up channels or roles!'
                });
            } else {
                await interaction.reply({
                    content: '❌ Failed to clean up channels or roles!',
                    ephemeral: true
                });
            }
        }
    }
};
