const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createvideoevent')
    .setDescription('Create video call event channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true }); // Immediate response to prevent timeout

    const guild = interaction.guild;
    const verifiedRoleId = "692985789608362005"; // Only verified members can see the category

    // Check if an event already exists.
    const existingEvent = await VideoEvent.findOne({ guildId: guild.id });
    if (existingEvent) {
      return interaction.editReply('❌ An event already exists in this guild. Use the cleanup command first.');
    }

    try {
      // Create the "Video Verified" role
      let videoVerifiedRole = guild.roles.cache.find(r => r.name === "Video Verified");
      if (!videoVerifiedRole) {
        videoVerifiedRole = await guild.roles.create({
          name: "Video Verified",
          color: 0x3498db, // Hex color (Fix for DiscordAPIError)
          reason: "Required for video call access",
          permissions: [],
        });
      }

      // Create a category with permission overwrites
      const category = await guild.channels.create({
        name: 'Video Event Category',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, // @everyone can't see
          { id: verifiedRoleId, allow: [PermissionFlagsBits.ViewChannel] }, // Verified role can see
          { id: videoVerifiedRole.id, allow: [PermissionFlagsBits.ViewChannel] }, // Video Verified can see
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
        ],
      });

      // Create the waiting room voice channel
      const waitingRoom = await guild.channels.create({
        name: '🚪 Waiting Room',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          { id: verifiedRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
        ],
      });

      // Create the video call voice channel
      const videoChannel = await guild.channels.create({
        name: '📹 Video Call',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }, // @everyone denied
          { id: videoVerifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
        ],
      });

      // Save the event record
      await VideoEvent.create({
        guildId: guild.id,
        categoryId: category.id,
        waitingRoomId: waitingRoom.id,
        videoChannelId: videoChannel.id,
        videoVerifiedRoleId: videoVerifiedRole.id,
      });

      // Edit the original reply with success message
      return interaction.editReply(`✅ Video event channels created!\nCategory: <#${category.id}>\nWaiting Room: <#${waitingRoom.id}>\nVideo Call: <#${videoChannel.id}>`);
    } catch (error) {
      console.error('Error creating video event channels:', error);
      return interaction.editReply('❌ Failed to create video event channels. Check bot permissions and try again.');
    }
  },
};