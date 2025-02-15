const VideoEvent = require('../models/videocallevent');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    if (newState.member.user.bot) return;

    const guild = newState.guild;
    const event = await VideoEvent.findOne({ guildId: guild.id });
    if (!event) return;

    const verifiedRoleId = "692985789608362005";
    const videoVerifiedRole = guild.roles.cache.get(event.videoVerifiedRoleId);
    if (!videoVerifiedRole) return;

    const waitingRoomId = event.waitingRoomId;
    const videoChannelId = event.videoChannelId;

    const moveMember = async (member, targetChannelId, reason) => {
      if (member.voice.channelId === targetChannelId) return;
      try {
        await member.setChannel(targetChannelId, reason);
        console.log(`${member.user.tag} moved to ${targetChannelId}: ${reason}`);
      } catch (error) {
        console.error(`Error moving ${member.user.tag} to ${targetChannelId}:`, error);
      }
    };

    // If user is in the Waiting Room
    if (newState.channelId === waitingRoomId) {
      if (newState.selfVideo) {
        if (!newState.member.roles.cache.has(videoVerifiedRole.id)) {
          await newState.member.roles.add(videoVerifiedRole);
          console.log(`${newState.member.user.tag} granted Video Verified role.`);
        }
      } else {
        if (newState.member.roles.cache.has(videoVerifiedRole.id)) {
          await newState.member.roles.remove(videoVerifiedRole);
          console.log(`${newState.member.user.tag} removed from Video Verified role.`);
        }
      }
    }

    // If user is in the Video Call channel
    if (newState.channelId === videoChannelId) {
      if (!newState.selfVideo) {
        await moveMember(newState.member, waitingRoomId, 'You must have video enabled in the video call.');
        await newState.member.roles.remove(videoVerifiedRole);
      }
    }
  },
};