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
            // Delete channels
            const category = guild.channels.cache.get(eventData.categoryId);
            const waitingRoom = guild.channels.cache.get(eventData.waitingRoomId);
            const videoChannel = guild.channels.cache.get(eventData.videoChannelId);

            await Promise.all([
                category?.delete(),
                waitingRoom?.delete(),
                videoChannel?.delete()
            ]);

            // Remove from DB
            await VideoEvent.deleteOne({ guildId: guild.id });

            await interaction.reply({
                content: '✅ Successfully cleaned up event channels!',
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
