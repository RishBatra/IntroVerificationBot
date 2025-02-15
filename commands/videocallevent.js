const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createvideoevent')
    .setDescription('Create video call event channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const verifiedRoleId = "692985789608362005"; // Verified role ID

    // Check if an event already exists
    const existingEvent = await VideoEvent.findOne({ guildId: guild.id });
    if (existingEvent) {
      return interaction.editReply('❌ An event already exists in this guild. Use the cleanup command first.');
    }

    try {
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply('❌ Bot is missing "Manage Roles" permission.');
      }

      // Create or fetch the "Video Verified" role
      let videoVerifiedRole = guild.roles.cache.find(r => r.name === "Video Verified");
      if (!videoVerifiedRole) {
        videoVerifiedRole = await guild.roles.create({
          name: "Video Verified",
          color: 0x3498db,
          reason: "Required for video call access",
          permissions: [],
        });
      }

      // Create the Video Event category
      const category = await guild.channels.create({
        name: '🎥 Video Event',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: verifiedRoleId, allow: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
        ],
      });

      // Create the Waiting Room
      const waitingRoom = await guild.channels.create({
        name: '🚪 Waiting Room',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          { id: verifiedRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
        ],
      });

      // Create the Video Call (Hidden by default)
      const videoChannel = await guild.channels.create({
        name: '📹 Video Call',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
          { id: verifiedRoleId, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
          { id: videoVerifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
        ],
      });

      // Create the Linked Voice Text Channel
      const videoTextChannel = await guild.channels.create({
        name: '📢 video-chat',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: verifiedRoleId, deny: [PermissionFlagsBits.ViewChannel] }, 
          { id: videoVerifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
        ],
      });

      // Save the event in the database
      await VideoEvent.create({
        guildId: guild.id,
        categoryId: category.id,
        waitingRoomId: waitingRoom.id,
        videoChannelId: videoChannel.id,
        videoTextChannelId: videoTextChannel.id, // Store the linked text channel
        videoVerifiedRoleId: videoVerifiedRole.id, // Store role ID
      });

      return interaction.editReply(`✅ Video event setup complete!\n
      **Waiting Room:** <#${waitingRoom.id}>
      **Video Call:** <#${videoChannel.id}>
      **Voice Text Channel:** <#${videoTextChannel.id}>`);
    } catch (error) {
      console.error('Error creating video event:', error);
      return interaction.editReply('❌ Failed to create video event.');
    }
  },
};