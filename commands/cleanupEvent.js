const { SlashCommandBuilder } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleanup-event')
    .setDescription('Remove video event channels and clean up event records'),
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      
      const guild = interaction.guild;
      const eventData = await VideoEvent.findOne({ guildId: guild.id });
      if (!eventData) {
        return await interaction.editReply({
          content: '❌ No active event to clean up!'
        });
      }
      
      const channelIds = [eventData.waitingRoomId, eventData.videoChannelId, eventData.categoryId];
      for (const channelId of channelIds) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          try {
            await channel.delete("Cleaning up video event channels");
            console.log(`Deleted channel: ${channel.name} (${channel.id})`);
          } catch (err) {
            console.error(`Failed to delete channel ${channel.id}:`, err);
          }
        }
      }
      
      // Optionally delete the "Video Enabled" role if it exists and is not the verified role.
      const verifiedRoleId = "692985789608362005";
      const videoRole = guild.roles.cache.find(r => r.name === "Video Enabled");
      if (videoRole && videoRole.id !== verifiedRoleId) {
        try {
          await videoRole.delete("Cleaning up event roles");
          console.log(`Deleted role: Video Enabled (${videoRole.id})`);
        } catch (err) {
          console.error("Failed to delete Video Enabled role:", err);
        }
      }
      
      await VideoEvent.deleteOne({ guildId: guild.id });
      
      await interaction.editReply({
        content: '✅ Successfully cleaned up all event channels and records!'
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