// File: commands/cleanupevent.js
const { SlashCommandBuilder } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup-event')
        .setDescription('Remove video event channels'),
    async execute(interaction) {
        const guild = interaction.guild;

        const eventData = await VideoEvent.findOne({ guildId: guild.id });
        if (!eventData) {
            return interaction.reply({
                content: '❌ No active event to clean up!',
                ephemeral: true
            });
        }

        try {
            // Delete channels first
            const channels = [
                guild.channels.cache.get(eventData.waitingRoomId),
                guild.channels.cache.get(eventData.videoChannelId),
                guild.channels.cache.get(eventData.categoryId)
            ].filter(c => c);

            // Delete in sequence to prevent orphaned channels
            for (const channel of channels) {
                await channel?.delete().catch(console.error);
            }

            // Remove from DB after successful deletion
            await VideoEvent.deleteOne({ guildId: guild.id });

            await interaction.reply({
                content: '✅ Successfully cleaned up all event channels!',
                ephemeral: true
            });

        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: '❌ Failed to clean up channels!',
                ephemeral: true
            });
        }
    }
};
