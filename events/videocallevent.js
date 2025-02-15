const VideoEvent = require('../models/videocallevent');

const gracePeriod = new Map(); // Store users who recently switched channels

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

    const videoVerifiedRole = guild.roles.cache.get(event.videoVerifiedRoleId);
    if (!videoVerifiedRole) {
      console.log(`[ERROR] Video Verified role not found. Run /createvideoevent again.`);
      return;
    }

    const waitingRoomId = event.waitingRoomId;
    const videoChannelId = event.videoChannelId;

    console.log(`[DEBUG] User: ${newState.member.user.tag} | Channel: ${newState.channelId} | Video: ${newState.selfVideo}`);

    const updateRole = async (member, add) => {
      try {
        if (add) {
          if (!member.roles.cache.has(videoVerifiedRole.id)) {
            await member.roles.add(videoVerifiedRole);
            console.log(`[DEBUG] ${member.user.tag} granted Video Verified role.`);
          } else {
            console.log(`[DEBUG] ${member.user.tag} already has the role.`);
          }
        } else {
          if (member.roles.cache.has(videoVerifiedRole.id)) {
            await member.roles.remove(videoVerifiedRole);
            console.log(`[DEBUG] ${member.user.tag} removed from Video Verified role.`);
          } else {
            console.log(`[DEBUG] ${member.user.tag} does not have the role.`);
          }
        }
      } catch (error) {
        console.error(`[ERROR] Failed to update role for ${member.user.tag}:`, error);
      }
    };

    // 🎯 **User Enters the Waiting Room**
    if (newState.channelId === waitingRoomId) {
      console.log(`[DEBUG] ${newState.member.user.tag} joined the Waiting Room.`);
      if (newState.selfVideo) {
        console.log(`[DEBUG] ${newState.member.user.tag} turned ON video.`);
        await updateRole(newState.member, true);
      } else {
        console.log(`[DEBUG] ${newState.member.user.tag} turned OFF video.`);
        await updateRole(newState.member, false);
      }
    }

    // 🎯 **User Moves to the Video Call Channel**
    if (newState.channelId === videoChannelId) {
      console.log(`[DEBUG] ${newState.member.user.tag} moved to the Video Call.`);

      // **Apply Grace Period (5 seconds)**
      gracePeriod.set(newState.member.id, true);

      setTimeout(async () => {
        gracePeriod.delete(newState.member.id);

        // **Fetch latest voice state to check if user is still in the channel**
        const updatedState = guild.members.cache.get(newState.member.id)?.voice;
        if (!updatedState || updatedState.channelId !== videoChannelId) {
          console.log(`[DEBUG] ${newState.member.user.tag} left the channel, skipping move.`);
          return; // User left, no action needed.
        }

        // **Check if video is still off after grace period**
        if (!updatedState.selfVideo) {
          console.log(`[DEBUG] ${newState.member.user.tag} still has video OFF after grace period. Moving them back.`);
          await newState.member.voice.setChannel(waitingRoomId, 'You must have video enabled in the video call.');
          await updateRole(newState.member, false);
        } else {
          console.log(`[DEBUG] ${newState.member.user.tag} successfully turned video ON, keeping them in Video Call.`);
        }
      }, 5000); // 5-second grace period

      return; // Exit early to avoid removing the role immediately
    }

    // 🎯 **User is in the Video Call but Turns Off Video (AFTER Grace Period)**
    if (oldState.channelId === videoChannelId && !newState.selfVideo) {
      if (gracePeriod.has(newState.member.id)) {
        console.log(`[DEBUG] ${newState.member.user.tag} is in grace period, skipping move.`);
        return;
      }

      console.log(`[DEBUG] ${newState.member.user.tag} turned OFF video in Video Call. Moving them back.`);
      await newState.member.voice.setChannel(waitingRoomId, 'You must have video enabled in the video call.');
      await updateRole(newState.member, false);
    }
  },
};