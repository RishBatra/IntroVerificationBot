const VideoEvent = require('../models/videocallevent');
const Whitelist = require('../models/whitelist');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    try {
      // Ignore bot updates
      if (newState.member.user.bot) return;

      // Get video event configuration
      const videoEvent = await VideoEvent.findOne({ guildId: newState.guild.id });
      
      // If no video event exists, don't log anything and exit early
      if (!videoEvent) return;

      // Now we know there's a video event, let's check if this update involves video channels
      const isOldChannelVideo = oldState.channel && [videoEvent.waitingRoomId, videoEvent.videoChannelId].includes(oldState.channelId);
      const isNewChannelVideo = newState.channel && [videoEvent.waitingRoomId, videoEvent.videoChannelId].includes(newState.channelId);

      // Only process if either channel is a video event channel
      if (!isOldChannelVideo && !isNewChannelVideo) return;

      console.log(`[VideoEvent] Processing video channel update for ${newState.member.user.tag}`);

      const videoVerifiedRole = newState.guild.roles.cache.get(videoEvent.videoVerifiedRoleId);
      if (!videoVerifiedRole) {
        console.error(`[VideoEvent] Video Verified role not found`);
        return;
      }

      const voiceTextManager = newState.client.voiceTextManager;
      const guild = newState.guild;

      // Use newState.channel if available; otherwise, fallback to oldState.channel.
      const currentChannel = newState.channel || oldState.channel;
      if (!currentChannel) {
        console.log(`[VideoEvent] No channel available in voice state update.`);
        return;
      }
      
      // Determine if the current voice channel belongs to the "Video Events" category.
      const isVideoEventCategory = currentChannel.parent?.name === 'Video Events';
      console.log(`[VideoEvent] Current channel parent: ${currentChannel.parent?.name}. isVideoEventCategory: ${isVideoEventCategory}`);
      
      // ***************** Video Event Logic Only *****************
      if (videoEvent && isVideoEventCategory) {
        console.log(`[VideoEvent] Video event configured and channel is in Video Events category.`);
        const waitingRoomId = videoEvent.waitingRoomId;
        const videoChannelId = videoEvent.videoChannelId;

        const isWhitelisted = await Whitelist.findOne({ guildId: guild.id, userId: newState.member.id });
        if (isWhitelisted) {
          console.log(`[VideoEvent] Member ${newState.member.id} is whitelisted. Skipping video event logic.`);
          return;
        }

        const updateRole = async (member, add) => {
          try {
            if (add) {
              if (!member.roles.cache.has(videoVerifiedRole.id)) {
                await member.roles.add(videoVerifiedRole);
                console.log(`[VideoEvent] Added videoVerifiedRole to ${member.id}`);
              }
            } else {
              if (member.roles.cache.has(videoVerifiedRole.id)) {
                await member.roles.remove(videoVerifiedRole);
                console.log(`[VideoEvent] Removed videoVerifiedRole from ${member.id}`);
              }
            }
          } catch (error) {
            console.error(`[VideoEvent] Failed to update role for ${member.user.tag}: ${error}`);
          }
        };

        // When a member joins the waiting room channel.
        if (newState.channelId === waitingRoomId) {
          console.log(`[VideoEvent] Member ${newState.member.id} joined Waiting Room (${waitingRoomId}).`);
          if (newState.selfVideo) {
            await updateRole(newState.member, true);
          } else {
            await updateRole(newState.member, false);
          }
        }

        // When a member joins the video channel, set a timeout for further actions.
        if (newState.channelId === videoChannelId) {
          console.log(`[VideoEvent] Member ${newState.member.id} joined Video Channel (${videoChannelId}).`);
          setTimeout(async () => {
            const updatedState = guild.members.cache.get(newState.member.id)?.voice;
            if (!updatedState || updatedState.channelId !== videoChannelId || updatedState.selfVideo) {
              console.log(`[VideoEvent] Member ${newState.member.id} did not stay in Video Channel or is sharing video; no further action.`);
              return;
            }
            console.log(`[VideoEvent] Moving member ${newState.member.id} to Waiting Room (${waitingRoomId}) and updating roles.`);
            await newState.member.voice.setChannel(waitingRoomId);
            await updateRole(newState.member, false);
            
            // Purge messages if the linked text channel is no longer in use.
            if (voiceTextManager) {
              voiceTextManager.channelCooldowns.delete(newState.channelId);
              const textChannel = await voiceTextManager.getOrCreateTextChannel(currentChannel);
              if (textChannel && currentChannel.members.size === 0) {
                console.log(`[VideoEvent] Purging messages for text channel ${textChannel.id}.`);
                await voiceTextManager.purgeChannelMessages(textChannel);
              }
            }
          }, videoEvent.timeoutDuration || 10000);
        }
      }
    } catch (error) {
      console.error('[VideoEvent] Error processing voice state update:', error);
    }
  }
};