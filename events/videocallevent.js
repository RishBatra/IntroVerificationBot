const VideoEvent = require('../models/videocallevent');

// A Map to debounce rapid toggles per member.
const debounceMap = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    // Ignore updates from bots.
    if (newState.member.user.bot) return;

    const guild = newState.guild;
    const event = await VideoEvent.findOne({ guildId: guild.id });
    if (!event) return;

    // Only process verified members.
    const verifiedRoleId = "692985789608362005";
    if (!newState.member.roles.cache.has(verifiedRoleId)) {
      console.log(`${newState.member.user.tag} is not verified; skipping move.`);
      return;
    }

    // IDs for our channels.
    const waitingRoomId = event.waitingRoomId;
    const videoChannelId = event.videoChannelId;

    // Helper: move the member if not already in the target channel.
    const moveMember = async (member, targetChannelId, reason) => {
      if (member.voice.channelId === targetChannelId) return;
      try {
        await member.setChannel(targetChannelId, reason);
        console.log(`${member.user.tag} moved to ${targetChannelId}: ${reason}`);
      } catch (error) {
        console.error(`Error moving ${member.user.tag} to ${targetChannelId}:`, error);
      }
    };

    // CASE 1: User in Waiting Room turns on video.
    if (
      newState.channelId === waitingRoomId &&
      !oldState.selfVideo &&
      newState.selfVideo
    ) {
      // Cancel any pending timeout.
      if (debounceMap.has(newState.id)) {
        clearTimeout(debounceMap.get(newState.id));
        debounceMap.delete(newState.id);
      }
      await moveMember(newState.member, videoChannelId, 'User enabled video');
    }
    // CASE 2: User in Video Call turns off video.
    else if (
      newState.channelId === videoChannelId &&
      oldState.selfVideo &&
      !newState.selfVideo
    ) {
      // Debounce to avoid transient toggles.
      if (debounceMap.has(newState.id)) {
        clearTimeout(debounceMap.get(newState.id));
      }
      const timeout = setTimeout(async () => {
        // Recheck voice state before moving.
        if (
          newState.member.voice.channelId === videoChannelId &&
          !newState.selfVideo
        ) {
          await moveMember(newState.member, waitingRoomId, 'User disabled video');
        }
        debounceMap.delete(newState.id);
      }, 3000); // 3-second debounce delay.
      debounceMap.set(newState.id, timeout);
    }
  },
};
