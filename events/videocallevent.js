const VideoEvent = require('../models/videocallevent');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    if (newState.member.user.bot) return;

    const guild = newState.guild;
    const event = await VideoEvent.findOne({ guildId: guild.id });
    if (!event) {
      console.log(`[DEBUG] No video event found for this guild.`);
      return;
    }

    // Fetch role using saved ID
    const videoVerifiedRole = guild.roles.cache.get(event.videoVerifiedRoleId);
    
    if (!videoVerifiedRole) {
      console.log(`[ERROR] "Video Verified" role ID from database is invalid. Run /createvideoevent again.`);
      return;
    }

    const waitingRoomId = event.waitingRoomId;
    const videoChannelId = event.videoChannelId;

    console.log(`[DEBUG] User: ${newState.member.user.tag} | Channel: ${newState.channelId} | Video: ${newState.selfVideo}`);

    const updateRole = async (member, add) => {
      try {
        if (add) {
          await member.roles.add(videoVerifiedRole);
          console.log(`[DEBUG] ${member.user.tag} granted Video Verified role.`);
        } else {
          await member.roles.remove(videoVerifiedRole);
          console.log(`[DEBUG] ${member.user.tag} removed from Video Verified role.`);
        }
      } catch (error) {
        console.error(`[ERROR] Failed to update role for ${member.user.tag}:`, error);
      }
    };

    if (newState.channelId === waitingRoomId) {
      console.log(`[DEBUG] ${newState.member.user.tag} is in the Waiting Room.`);
      if (newState.selfVideo) {
        console.log(`[DEBUG] ${newState.member.user.tag} turned ON video.`);
        await updateRole(newState.member, true);
      } else {
        console.log(`[DEBUG] ${newState.member.user.tag} turned OFF video.`);
        await updateRole(newState.member, false);
      }
    }

    if (newState.channelId === videoChannelId) {
      console.log(`[DEBUG] ${newState.member.user.tag} is in the Video Call.`);
      if (!newState.selfVideo) {
        console.log(`[DEBUG] ${newState.member.user.tag} turned OFF video in Video Call. Moving them back.`);
        await newState.member.voice.setChannel(waitingRoomId, 'You must have video enabled in the video call.');
        await updateRole(newState.member, false);
      }
    }
  },
};