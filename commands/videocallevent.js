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

    const existingEvent = await VideoEvent.findOne({ guildId: guild.id });
    if (existingEvent) {
      return interaction.editReply('❌ An event already exists in this guild. Use the cleanup command first.');
    }

    try {
      // Ensure bot has Manage Roles permission
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply('❌ Bot is missing "Manage Roles" permission. Please fix it and try again.');
      }

      // Create or fetch the "Video Verified" role
      let videoVerifiedRole = guild.roles.cache.find(r => r.name === "Video Verified");
      if (!videoVerifiedRole) {
        console.log(`[DEBUG] Creating "Video Verified" role...`);
        videoVerifiedRole = await guild.roles.create({
          name: "Video Verified",
          color: 0x3498db,
          reason: "Required for video call access",
          permissions: [],
        });
        console.log(`[DEBUG] "Video Verified" role created successfully.`);
      } else {
        console.log(`[DEBUG] "Video Verified" role already exists.`);
      }

      // Create the Video Event category
      const category = await guild.channels.create({
        name: 'Video Event Category',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, 
          { id: verifiedRoleId, allow: [PermissionFlagsBits.ViewChannel] }, 
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
        ],
      });

      // Create the Waiting Room channel
      const waitingRoom = await guild.channels.create({
        name: '🚪 Waiting Room',
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          { id: verifiedRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
        ],
      });

      // Create the Video Call channel (Hidden by default)
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

      // Save the event in the database
      await VideoEvent.create({
        guildId: guild.id,
        categoryId: category.id,
        waitingRoomId: waitingRoom.id,
        videoChannelId: videoChannel.id,
        videoVerifiedRoleId: videoVerifiedRole.id, // Save the role ID
      });

      return interaction.editReply(`✅ Video event channels created!\nCategory: <#${category.id}>\nWaiting Room: <#${waitingRoom.id}>\nVideo Call: (Hidden until video is enabled)`);
    } catch (error) {
      console.error('Error creating video event channels:', error);
      return interaction.editReply('❌ Failed to create video event channels. Check bot permissions and try again.');
    }
  },
};