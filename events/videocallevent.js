const VideoEvent = require('../models/videocallevent');
const Whitelist = require('../models/whitelist');

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

    const TIMEOUT_DURATION = event.timeoutDuration || 10000; // Default: 10 sec

    const videoVerifiedRole = guild.roles.cache.get(event.videoVerifiedRoleId);
    if (!videoVerifiedRole) {
      console.log(`[ERROR] Video Verified role not found. Run /createvideoevent again.`);
      return;
    }

    const waitingRoomId = event.waitingRoomId;
    const videoChannelId = event.videoChannelId;

    console.log(`[DEBUG] User: ${newState.member.user.tag} | Channel: ${newState.channelId} | Video: ${newState.selfVideo}`);

    // **Check if User is Whitelisted**
    const isWhitelisted = await Whitelist.findOne({ guildId: guild.id, userId: newState.member.id });
    if (isWhitelisted) {
      console.log(`[DEBUG] ${newState.member.user.tag} is whitelisted. Skipping video enforcement.`);
      return;
    }

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

    // 🎯 **User Enters the Waiting Room**
    if (newState.channelId === waitingRoomId) {
      console.log(`[DEBUG] ${newState.member.user.tag} joined the Waiting Room.`);
      if (newState.selfVideo) {
        await updateRole(newState.member, true);
      } else {
        await updateRole(newState.member, false);
      }
    }

    // 🎯 **User Moves to the Video Call Channel**
    if (newState.channelId === videoChannelId) {
      console.log(`[DEBUG] ${newState.member.user.tag} moved to the Video Call.`);

      // **Wait TIMEOUT_DURATION before checking video**
      setTimeout(async () => {
        const updatedState = guild.members.cache.get(newState.member.id)?.voice;
        if (!updatedState || updatedState.channelId !== videoChannelId) {
          console.log(`[DEBUG] ${newState.member.user.tag} left the channel, skipping check.`);
          return;
        }

        if (!updatedState.selfVideo) {
          console.log(`[DEBUG] ${newState.member.user.tag} still has video OFF after ${TIMEOUT_DURATION / 1000} sec. Moving them back.`);
          await newState.member.voice.setChannel(waitingRoomId, 'You must have video enabled in the video call.');
          await updateRole(newState.member, false);
        }
      }, TIMEOUT_DURATION);
      return;
    }

    // 🎯 **User is in the Video Call but Turns Off Video**
    if (oldState.channelId === videoChannelId && !newState.selfVideo) {
      console.log(`[DEBUG] ${newState.member.user.tag} turned OFF video in Video Call. Moving them back.`);
      await newState.member.voice.setChannel(waitingRoomId, 'You must have video enabled in the video call.');
      await updateRole(newState.member, false);
    }
  },
};