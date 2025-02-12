const VideoEvent = require('../models/videocallevent');

// Map to store debounce timers per member.
const debounceMap = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    // Ignore bots.
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

    const waitingRoomId = event.waitingRoomId;
    const videoChannelId = event.videoChannelId;

    // Helper function to move a member if not already in target channel.
    const moveMember = async (member, targetChannelId, reason) => {
      if (member.voice.channelId === targetChannelId) return;
      try {
        await member.setChannel(targetChannelId, reason);
        console.log(`${member.user.tag} moved to ${targetChannelId}: ${reason}`);
      } catch (error) {
        console.error(`Error moving ${member.user.tag} to ${targetChannelId}:`, error);
      }
    };

    // --- Enforce Video Call Channel Rules ---
    if (newState.channelId === videoChannelId) {
      // If the member is in the video channel but does NOT have video enabled...
      if (!newState.selfVideo) {
        // If they just joined the video channel (oldState.channelId is different), move them immediately.
        if (oldState.channelId !== videoChannelId) {
          await moveMember(newState.member, waitingRoomId, 'You must enable video to join the video call.');
        } else {
          // Otherwise (if they toggled video off while in the video channel), debounce the move.
          if (debounceMap.has(newState.id)) {
            clearTimeout(debounceMap.get(newState.id));
          }
          const timeout = setTimeout(async () => {
            if (newState.member.voice.channelId === videoChannelId && !newState.selfVideo) {
              await moveMember(newState.member, waitingRoomId, 'You must have video enabled in the video call.');
            }
            debounceMap.delete(newState.id);
          }, 3000);
          debounceMap.set(newState.id, timeout);
        }
      }
    }
    // --- Handle Waiting Room: Auto-move to Video Channel if Video Enabled ---
    else if (newState.channelId === waitingRoomId) {
      // If the user was not using video before and now has it enabled, move them to the video call channel.
      if (!oldState.selfVideo && newState.selfVideo) {
        if (debounceMap.has(newState.id)) {
          clearTimeout(debounceMap.get(newState.id));
          debounceMap.delete(newState.id);
        }
        await moveMember(newState.member, videoChannelId, 'You enabled video.');
      }
    }
  },
};