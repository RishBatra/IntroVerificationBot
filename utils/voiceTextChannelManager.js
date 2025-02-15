const VideoEvent = require('../models/videocallevent');

const activeTimers = new Map(); // Store active move timers to avoid duplicates

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
          }
        } else {
          if (member.roles.cache.has(videoVerifiedRole.id)) {
            await member.roles.remove(videoVerifiedRole);
            console.log(`[DEBUG] ${member.user.tag} removed from Video Verified role.`);
          }
        }
      } catch (error) {
        console.error(`[ERROR] Failed to update role for ${member.user.tag}:`, error);
      }
    };

    // 🎯 **User Joins the Waiting Room**
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

      // Cancel any existing timer for this user
      if (activeTimers.has(newState.member.id)) {
        clearTimeout(activeTimers.get(newState.member.id));
        activeTimers.delete(newState.member.id);
      }

      // **Wait 5 seconds before checking video to avoid Discord's auto-off issue**
      const timer = setTimeout(async () => {
        activeTimers.delete(newState.member.id);

        // **Fetch latest state**
        const updatedState = guild.members.cache.get(newState.member.id)?.voice;
        if (!updatedState || updatedState.channelId !== videoChannelId) {
          console.log(`[DEBUG] ${newState.member.user.tag} left the channel, skipping check.`);
          return;
        }

        // **Check if video is still off after 5 seconds**
        if (!updatedState.selfVideo) {
          console.log(`[DEBUG] ${newState.member.user.tag} still has video OFF after 5 seconds. Moving them back.`);
          await newState.member.voice.setChannel(waitingRoomId, 'You must have video enabled in the video call.');
          await updateRole(newState.member, false);
        } else {
          console.log(`[DEBUG] ${newState.member.user.tag} successfully turned video ON, keeping them in Video Call.`);
        }
      }, 5000); // **Wait 5 seconds before enforcing rules**

      activeTimers.set(newState.member.id, timer);

      return; // Exit early to prevent immediate role removal
    }

    // 🎯 **User is in the Video Call but Turns Off Video (After Buffer Time)**
    if (oldState.channelId === videoChannelId && !newState.selfVideo) {
      console.log(`[DEBUG] ${newState.member.user.tag} turned OFF video in Video Call. Moving them back.`);
      await newState.member.voice.setChannel(waitingRoomId, 'You must have video enabled in the video call.');
      await updateRole(newState.member, false);
    }
  },
};