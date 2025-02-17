const VideoEvent = require('../models/videocallevent');
const Whitelist = require('../models/whitelist');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    // Ignore bot updates
    if (newState.member.user.bot) return;

    const guild = newState.guild;
    const videoEvent = await VideoEvent.findOne({ guildId: guild.id });
    
    // If no video event configured, exit early
    if (!videoEvent) return;

    // Get current channel (prefer newState's channel)
    const currentChannel = newState.channel || oldState.channel;
    if (!currentChannel) return;

    // Check if this is a video event channel
    const isVideoChannel = [
      videoEvent.waitingRoomId,
      videoEvent.videoChannelId
    ].includes(currentChannel.id);

    // Only process if this is a video event channel
    if (isVideoChannel) {
      const videoVerifiedRole = guild.roles.cache.get(videoEvent.videoVerifiedRoleId);
      if (!videoVerifiedRole) {
        console.log(`[VideoEvent] ERROR: Video Verified role not found for guild ${guild.id}`);
        return;
      }

      // Check whitelist
      const isWhitelisted = await Whitelist.findOne({ 
        guildId: guild.id, 
        userId: newState.member.id 
      });
      if (isWhitelisted) {
        console.log(`[VideoEvent] Member ${newState.member.id} is whitelisted`);
        return;
      }

      // Handle waiting room
      if (newState.channelId === videoEvent.waitingRoomId) {
        if (newState.selfVideo) {
          await newState.member.roles.add(videoVerifiedRole);
          console.log(`[VideoEvent] Granted video role to ${newState.member.id}`);
        } else {
          await newState.member.roles.remove(videoVerifiedRole);
          console.log(`[VideoEvent] Removed video role from ${newState.member.id}`);
        }
      }

      // Handle video channel
      if (newState.channelId === videoEvent.videoChannelId) {
        setTimeout(async () => {
          const updatedState = guild.members.cache.get(newState.member.id)?.voice;
          if (!updatedState || updatedState.channelId !== videoEvent.videoChannelId) {
            return;
          }

          if (!updatedState.selfVideo) {
            console.log(`[VideoEvent] Moving ${newState.member.id} to waiting room - no video`);
            await newState.member.voice.setChannel(videoEvent.waitingRoomId, 
              'You must have video enabled in the video call.');
            await newState.member.roles.remove(videoVerifiedRole);
          }
        }, videoEvent.timeoutDuration || 10000);
      }
    }
  }
};