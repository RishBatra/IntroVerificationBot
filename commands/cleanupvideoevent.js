const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleanupvideoevent')
    .setDescription('Removes all video event channels and roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const event = await VideoEvent.findOne({ guildId: guild.id });

    if (!event) {
      return interaction.editReply('❌ No active video event found.');
    }

    try {
      // Fetch channels from guild cache
      const category = guild.channels.cache.get(event.categoryId);
      const waitingRoom = guild.channels.cache.get(event.waitingRoomId);
      const videoChannel = guild.channels.cache.get(event.videoChannelId);
      const videoTextChannel = guild.channels.cache.get(event.videoTextChannelId); // Fetch text channel

      // Fetch and delete role
      const videoVerifiedRole = guild.roles.cache.get(event.videoVerifiedRoleId);
      if (videoVerifiedRole) {
        await videoVerifiedRole.delete('Cleaning up Video Verified role');
        console.log(`[DEBUG] Deleted role: Video Verified`);
      }

      // Delete channels if they exist
      if (waitingRoom) await waitingRoom.delete('Cleaning up video event');
      if (videoChannel) await videoChannel.delete('Cleaning up video event');
      if (videoTextChannel) await videoTextChannel.delete('Cleaning up video event'); // Delete text channel
      if (category) await category.delete('Cleaning up video event');

      // Remove from database
      await VideoEvent.deleteOne({ guildId: guild.id });

      return interaction.editReply('✅ Video event and all related channels/roles have been removed.');
    } catch (error) {
      console.error('Error cleaning up video event:', error);
      return interaction.editReply('❌ Failed to remove video event.');
    }
  },
};