const VideoEvent = require('../models/videocallevent');
const Whitelist = require('../models/whitelist');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    try {
      // Ignore bot updates
      if (newState.member.user.bot) return;

      console.log(`[VideoEvent] voiceStateUpdate triggered. Old channel: ${oldState.channelId} New channel: ${newState.channelId}`);

      // Get video event configuration
      const videoEvent = await VideoEvent.findOne({ guildId: newState.guild.id });
      
      // If no video event exists, exit early
      if (!videoEvent) {
        console.log(`[VideoEvent] No video event configuration found for guild ${newState.guild.id}`);
        return;
      }

      // Get current channel (prefer newState's channel)
      const currentChannel = newState.channel || oldState.channel;
      if (!currentChannel) {
        console.log('[VideoEvent] No channel found in state update');
        return;
      }

      // Check if current channel is a video event channel
      const isVideoChannel = [
        videoEvent.waitingRoomId,
        videoEvent.videoChannelId
      ].includes(currentChannel.id);

      if (!isVideoChannel) {
        console.log(`[VideoEvent] Channel ${currentChannel.name} is not a video event channel`);
        return;
      }

      const videoVerifiedRole = newState.guild.roles.cache.get(videoEvent.videoVerifiedRoleId);
      if (!videoVerifiedRole) {
        console.error(`[VideoEvent] Video Verified role not found for guild ${newState.guild.id}`);
        return;
      }

      const guild = newState.guild;
      const voiceTextManager = newState.client.voiceTextManager;

      // Determine if the current voice channel belongs to the "Video Events" category.
      const isVideoEventCategory = currentChannel.parent?.name === 'Video Events';
      console.log(`[VideoEvent] Current channel parent: ${currentChannel.parent?.name}. isVideoEventCategory: ${isVideoEventCategory}`);
      
      // ***************** Video Event Logic *****************
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
      // ***************** Regular Voice Channel Logic *****************
      else if (voiceTextManager && !isVideoEventCategory) {
        // If the member left voice completely (newState.channel is null):
        if (!newState.channel) {
          console.log(`[VideoEvent] Member ${newState.member.id} left all voice channels.`);
          
          // Remove their access from the text channel linked to the channel they just left.
          if (oldState.channel) {
            await voiceTextManager.updateTextChannelVisibility(oldState.channel, newState.member, false);
          }
          
          // Additionally, iterate over ALL cached voice text channels and remove their view permission.
          for (const [voiceId, textChannel] of voiceTextManager.voiceTextChannels) {
            await textChannel.permissionOverwrites.edit(newState.member, { ViewChannel: false })
              .catch(console.error);
            console.log(`[VoiceTextChannelManager] Removed access for member ${newState.member.id} from text channel ${textChannel.id}.`);
            
            // If the associated voice channel is empty, purge its messages.
            const voiceChannel = guild.channels.cache.get(voiceId);
            if (!voiceChannel || voiceChannel.members.size === 0) {
              console.log(`[VoiceTextChannelManager] Voice channel ${voiceId} is empty. Purging messages from text channel ${textChannel.id}.`);
              await voiceTextManager.purgeChannelMessages(textChannel);
            }
          }
        }
        // If the member joins a voice channel:
        else {
          console.log(`[VideoEvent] Processing regular voice channel update for member ${newState.member.id} on channel ${newState.channel.id}.`);
          // Grant access for the channel the member just joined.
          await voiceTextManager.updateTextChannelVisibility(newState.channel, newState.member, true);
          
          // Remove access from all other voice-linked text channels.
          for (const [voiceId, textChannel] of voiceTextManager.voiceTextChannels) {
            if (voiceId !== newState.channel.id) {
              await textChannel.permissionOverwrites.edit(newState.member, { ViewChannel: false })
                .catch(console.error);
              console.log(`[VoiceTextChannelManager] Removed access for member ${newState.member.id} from text channel ${textChannel.id} (not current voice channel).`);
            }
          }
        }
      } else {
        console.log(`[VideoEvent] voiceTextManager is not defined or not applicable.`);
      }
    } catch (error) {
      console.error('[VideoEvent] Error processing voice state update:', error);
    }
  }
};