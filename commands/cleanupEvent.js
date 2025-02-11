// File: commands/cleanupevent.js
const { SlashCommandBuilder } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup-event')
        .setDescription('Remove video event channels and clean up event roles'),
    async execute(interaction) {
        const guild = interaction.guild;

        const eventData = await VideoEvent.findOne({ guildId: guild.id });
        if (!eventData) {
            return interaction.reply({
                content: '❌ No active event to clean up!',
                ephemeral: true,
            });
        }

        try {
            // Delete event channels (waiting room, video channel, and category if available)
            const channels = [
                guild.channels.cache.get(eventData.waitingRoomId),
                guild.channels.cache.get(eventData.videoChannelId),
                guild.channels.cache.get(eventData.categoryId)
            ].filter(c => c);

            for (const channel of channels) {
                await channel.delete().catch(console.error);
            }

            // Delete the "Video Enabled" role if it exists
            const videoRole = guild.roles.cache.find(r => r.name === "Video Enabled");
            if (videoRole) {
                await videoRole.delete("Cleaning up event roles").catch(console.error);
            }

            // Remove the event record from the database
            await VideoEvent.deleteOne({ guildId: guild.id });

            await interaction.reply({
                content: '✅ Successfully cleaned up all event channels and roles!',
                ephemeral: true,
            });
        } catch (error) {
            console.error("Error during cleanup:", error);
            await interaction.reply({
                content: '❌ Failed to clean up channels or roles!',
                ephemeral: true,
            });
        }
    }
};
