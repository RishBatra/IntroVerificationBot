const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createvideoevent')
    .setDescription('Create video call event channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true }); // Prevent interaction timeout

    const guild = interaction.guild;
    const verifiedRoleId = "692985789608362005"; // Verified role ID

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
          color: 0x3498db, // Hex color for blue
          reason: "Required for video call access",
          permissions: [],
        });
      }

      // Create the category with permission overwrites
      const category = await guild.channels.create({
        name: 'Video Event Category',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, // @everyone cannot see
          { id: verifiedRoleId, allow: [PermissionFlagsBits.ViewChannel] }, // Verified users can see the category
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
        ],
      });

      // Create the waiting room voice channel
      const waitingRoom = await guild.channels.create({
        name: '🚪 Waiting Room',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          { id: verifiedRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }, // Verified users can access
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
        ],
      });

      // Create the video call voice channel (HIDDEN by default)
      const videoChannel = await guild.channels.create({
        name: '📹 Video Call',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }, // @everyone cannot see or join
          { id: verifiedRoleId, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }, // Verified users cannot see or join
          { id: videoVerifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream] }, // Only Video Verified users can see/join
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

      return interaction.editReply(`✅ Video event channels created!\nCategory: <#${category.id}>\nWaiting Room: <#${waitingRoom.id}>\nVideo Call: (Hidden until video is enabled)`);
    } catch (error) {
      console.error('Error creating video event channels:', error);
      return interaction.editReply('❌ Failed to create video event channels. Check bot permissions and try again.');
    }
  },
};