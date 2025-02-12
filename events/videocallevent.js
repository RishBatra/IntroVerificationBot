const VideoEvent = require('../models/videocallevent');

// A Map to keep track of pending timeouts per member (for debouncing video toggles)
const debounceMap = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    // Ignore bot updates.
    if (newState.member.user.bot) return;

    const guild = newState.guild;
    const event = await VideoEvent.findOne({ guildId: guild.id });
    if (!event) return;

    // The role that marks a user as verified.
    const verifiedRoleId = "692985789608362005";

    // --- Enforce Category Visibility ---
    // If the event stored a category ID, update its permission overwrites so that:
    // • @everyone is denied the VIEW_CHANNEL permission
    // • Only members with the verified role can view it.
    if (event.categoryId) {
      const category = guild.channels.cache.get(event.categoryId);
      if (category) {
        try {
          await category.permissionOverwrites.edit(guild.id, { VIEW_CHANNEL: false });
          await category.permissionOverwrites.edit(verifiedRoleId, { VIEW_CHANNEL: true });
        } catch (err) {
          console.error("Error updating category permissions:", err);
        }
      }
    }

    // --- Only Process Verified Members ---
    if (!newState.member.roles.cache.has(verifiedRoleId)) {
      console.log(`${newState.member.user.tag} is not verified; skipping move.`);
      return;
    }

    const waitingRoomId = event.waitingRoomId;
    const videoChannelId = event.videoChannelId;

    // Helper: move member if not already in the target channel.
    const moveMember = async (member, targetChannelId, reason) => {
      if (member.voice.channelId === targetChannelId) return;
      try {
        await member.setChannel(targetChannelId, reason);
        console.log(`${member.user.tag} moved to ${targetChannelId}: ${reason}`);
      } catch (error) {
        console.error(`Error moving ${member.user.tag} to ${targetChannelId}:`, error);
      }
    };

    // --- Case 1: Member in Waiting Room Turns Video On ---
    if (
      newState.channelId === waitingRoomId &&
      !oldState.selfVideo &&
      newState.selfVideo
    ) {
      // Cancel any pending “move back” timeouts.
      if (debounceMap.has(newState.id)) {
        clearTimeout(debounceMap.get(newState.id));
        debounceMap.delete(newState.id);
      }
      await moveMember(newState.member, videoChannelId, "User enabled video");
    }
    // --- Case 2: Member in Video Call Turns Video Off ---
    else if (
      newState.channelId === videoChannelId &&
      oldState.selfVideo &&
      !newState.selfVideo
    ) {
      // Use a debounce delay (e.g. 3 seconds) to avoid transient toggles.
      if (debounceMap.has(newState.id)) {
        clearTimeout(debounceMap.get(newState.id));
      }
      const timeout = setTimeout(async () => {
        // Recheck the current voice state to confirm the video is still off.
        if (
          newState.member.voice.channelId === videoChannelId &&
          !newState.selfVideo
        ) {
          await moveMember(newState.member, waitingRoomId, "User disabled video");
        }
        debounceMap.delete(newState.id);
      }, 3000); // Delay in milliseconds; adjust as needed.
      debounceMap.set(newState.id, timeout);
    }
  },
};
