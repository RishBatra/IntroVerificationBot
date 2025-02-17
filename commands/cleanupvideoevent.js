const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VideoEvent = require('../models/videocallevent');
const Whitelist = require('../models/whitelist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleanupvideoevent')
    .setDescription('Removes all video event channels, roles, and data')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      const event = await VideoEvent.findOne({ guildId: guild.id });

      if (!event) {
        return interaction.editReply('❌ No active video event found.');
      }

      // Delete role if it exists
      const videoVerifiedRole = guild.roles.cache.get(event.videoVerifiedRoleId);
      if (videoVerifiedRole) {
        await videoVerifiedRole.delete('Cleaning up Video Verified role');
        console.log(`[DEBUG] Deleted role: Video Verified`);
      }

      // Delete channels if they exist
      const channels = [
        event.waitingRoomId,
        event.videoChannelId,
        event.videoTextChannelId
      ].filter(Boolean); // Remove any undefined/null values

      for (const channelId of channels) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          await channel.delete('Cleaning up video event');
          console.log(`[DEBUG] Deleted channel: ${channel.name}`);
        }
      }

      // Delete category if it exists and is empty
      if (event.categoryId) {
        const category = guild.channels.cache.get(event.categoryId);
        if (category && category.children.cache.size === 0) {
          await category.delete('Cleaning up empty video event category');
          console.log(`[DEBUG] Deleted empty category: ${category.name}`);
        }
      }

      // Clear whitelist
      await Whitelist.deleteMany({ guildId: guild.id });
      console.log(`[DEBUG] Cleared whitelist for guild: ${guild.id}`);

      // Delete event configuration
      await VideoEvent.deleteOne({ guildId: guild.id });
      console.log(`[DEBUG] Deleted video event configuration for guild: ${guild.id}`);

      return interaction.editReply('✅ Video event and all related channels, roles, and whitelist data have been removed.');
    } catch (error) {
      console.error('Error cleaning up video event:', error);
      return interaction.editReply('❌ An error occurred while cleaning up the video event.');
    }
  },
};