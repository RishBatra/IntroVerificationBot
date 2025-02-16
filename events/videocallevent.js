const VideoEvent = require('../models/videocallevent');
const Whitelist = require('../models/whitelist');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    console.log(`[VideoEvent] voiceStateUpdate triggered. Old channel: ${oldState.channelId} New channel: ${newState.channelId}`);
    // Ignore bots
    if (newState.member.user.bot) return;

    const guild = newState.guild;
    const videoEvent = await VideoEvent.findOne({ guildId: guild.id });
    const voiceTextManager = newState.client.voiceTextManager;

    // Use newState.channel if available, otherwise fallback to oldState.channel
    const currentChannel = newState.channel || oldState.channel;
    if (!currentChannel) {
      console.log(`[VideoEvent] No channel available in voice state update.`);
      return;
    }

    // Determine if the current voice channel is in the "Video Events" category
    const isVideoEventCategory = currentChannel.parent?.name === 'Video Events';
    console.log(`[VideoEvent] Current channel parent: ${currentChannel.parent?.name}. isVideoEventCategory: ${isVideoEventCategory}`);

    // If the channel belongs to the video events category and a video event is configured, run video event logic
    if (videoEvent && isVideoEventCategory) {
      console.log(`[VideoEvent] Video event configured and channel is in Video Events category.`);
      const videoVerifiedRole = guild.roles.cache.get(videoEvent.videoVerifiedRoleId);
      const waitingRoomId = videoEvent.waitingRoomId;
      const videoChannelId = videoEvent.videoChannelId;

      if (!videoVerifiedRole) {
        console.log(`[VideoEvent] ERROR: Video Verified role not found. Run /createvideoevent again.`);
        return;
      }

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

      // When a member joins the waiting room channel
      if (newState.channelId === waitingRoomId) {
        console.log(`[VideoEvent] Member ${newState.member.id} joined Waiting Room (${waitingRoomId}).`);
        if (newState.selfVideo) {
          await updateRole(newState.member, true);
        } else {
          await updateRole(newState.member, false);
        }
      }

      // When a member joins the video channel, set a timeout for further actions
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

          // Remove cooldown and purge text channel messages if applicable
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
    // Otherwise, if the channel is not in the "Video Events" category, use the voice-to-text manager
    else if (voiceTextManager && !isVideoEventCategory) {
      console.log(`[VideoEvent] Processing regular voice channel update for member ${newState.member.id} on channel ${currentChannel.id}.`);
      await voiceTextManager.updateTextChannelVisibility(
        currentChannel,
        newState.member,
        Boolean(newState.channel) // 'true' if joining; 'false' if leaving
      );
    }
  }
};