const VideoEvent = require('../models/videocallevent');
const Whitelist = require('../models/whitelist');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    if (newState.member.user.bot) return;

    const guild = newState.guild;
    const event = await VideoEvent.findOne({ guildId: guild.id });
    const voiceTextManager = newState.client.voiceTextManager;

    if (event) {
      const videoVerifiedRole = guild.roles.cache.get(event.videoVerifiedRoleId);
      const waitingRoomId = event.waitingRoomId;
      const videoChannelId = event.videoChannelId;

      if (!videoVerifiedRole) {
        console.log(`[ERROR] Video Verified role not found. Run /createvideoevent again.`);
        return;
      }

      const isWhitelisted = await Whitelist.findOne({ guildId: guild.id, userId: newState.member.id });
      if (isWhitelisted) return;

      const updateRole = async (member, add) => {
        try {
          if (add) {
            if (!member.roles.cache.has(videoVerifiedRole.id)) {
              await member.roles.add(videoVerifiedRole);
            }
          } else {
            if (member.roles.cache.has(videoVerifiedRole.id)) {
              await member.roles.remove(videoVerifiedRole);
            }
          }
        } catch (error) {
          console.error(`[ERROR] Failed to update role for ${member.user.tag}:`, error);
        }
      };

      if (newState.channelId === waitingRoomId) {
        if (newState.selfVideo) {
          await updateRole(newState.member, true);
        } else {
          await updateRole(newState.member, false);
        }
      }

      if (newState.channelId === videoChannelId) {
        setTimeout(async () => {
          const updatedState = guild.members.cache.get(newState.member.id)?.voice;
          if (!updatedState || updatedState.channelId !== videoChannelId || updatedState.selfVideo) return;

          await newState.member.voice.setChannel(waitingRoomId);
          await updateRole(newState.member, false);

          if (voiceTextManager) {
            voiceTextManager.channelCooldowns.delete(newState.channelId);
            const textChannel = await voiceTextManager.getOrCreateTextChannel(newState.channel);
            if (textChannel && newState.channel.members.size === 0) {
              await voiceTextManager.purgeChannelMessages(textChannel);
            }
          }
        }, event.timeoutDuration || 10000);
      }
    } else if (voiceTextManager) {
      await voiceTextManager.updateTextChannelVisibility(newState.channel, newState.member, !!newState.channel);
    }
  }
};