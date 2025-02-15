const VideoEvent = require('../models/videocallevent');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    if (newState.member.user.bot) return;

    const guild = newState.guild;
    const event = await VideoEvent.findOne({ guildId: guild.id });
    if (!event) return;

    const verifiedRoleId = "692985789608362005"; // Verified role ID
    const videoVerifiedRole = guild.roles.cache.get(event.videoVerifiedRoleId);
    if (!videoVerifiedRole) return;

    const waitingRoomId = event.waitingRoomId;
    const videoChannelId = event.videoChannelId;

    // Function to add or remove the Video Verified role
    const updateRole = async (member, add) => {
      try {
        if (add) {
          await member.roles.add(videoVerifiedRole);
          console.log(`${member.user.tag} granted Video Verified role.`);
        } else {
          await member.roles.remove(videoVerifiedRole);
          console.log(`${member.user.tag} removed from Video Verified role.`);
        }
      } catch (error) {
        console.error(`Error updating role for ${member.user.tag}:`, error);
      }
    };

    // If the user is in the Waiting Room
    if (newState.channelId === waitingRoomId) {
      if (newState.selfVideo) {
        // Add the Video Verified role when video is enabled
        if (!newState.member.roles.cache.has(videoVerifiedRole.id)) {
          await updateRole(newState.member, true);
        }
      } else {
        // Remove the Video Verified role if video is disabled
        if (newState.member.roles.cache.has(videoVerifiedRole.id)) {
          await updateRole(newState.member, false);
        }
      }
    }

    // If the user is in the Video Call channel
    if (newState.channelId === videoChannelId) {
      if (!newState.selfVideo) {
        // Move them back to the Waiting Room if video is disabled
        await newState.member.voice.setChannel(waitingRoomId, 'You must have video enabled in the video call.');
        await updateRole(newState.member, false); // Remove the role if they disable video
      }
    }
  },
};