// File: events/videocallevent.js
const { Events } = require('discord.js');
const VideoEvent = require('../models/videocallevent');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = newState.guild;
        const eventData = await VideoEvent.findOne({ guildId: guild.id });
        if (!eventData) return;

        const { waitingRoomId, videoChannelId } = eventData;
        const member = newState.member;
        if (member.user.bot) return; // Ignore bots

        // Define the role name for video-enabled access
        const videoRoleName = "Video Enabled";
        let videoRole = guild.roles.cache.find(r => r.name === videoRoleName);
        if (!videoRole) {
            try {
                videoRole = await guild.roles.create({
                    name: videoRoleName,
                    reason: "Needed for event access to the video channel",
                });
            } catch (err) {
                console.error("Error creating video role:", err);
                return;
            }
        }

        // Ensure the video channel has the proper permission overwrites
        const videoChannel = guild.channels.cache.get(videoChannelId);
        if (videoChannel) {
            try {
                // Deny @everyone from viewing the video channel
                await videoChannel.permissionOverwrites.edit(guild.roles.everyone, {
                    ViewChannel: false,
                });
                // Allow members with the video role to view, connect, speak, and stream
                await videoChannel.permissionOverwrites.edit(videoRole, {
                    ViewChannel: true,
                    Connect: true,
                    Speak: true,
                    Stream: true,
                });
            } catch (err) {
                console.error("Error updating video channel permissions:", err);
            }
        }

        // Check the member's current video state (self video or streaming)
        const hasVideo = newState.selfVideo || newState.streaming;

        if (hasVideo) {
            // If the member has video enabled, add the role if they don't already have it
            if (!member.roles.cache.has(videoRole.id)) {
                try {
                    await member.roles.add(videoRole, "User enabled video for event");
                } catch (err) {
                    console.error("Error adding video role:", err);
                }
            }
        } else {
            // If video is not enabled, remove the role (if present)
            if (member.roles.cache.has(videoRole.id)) {
                try {
                    await member.roles.remove(videoRole, "User disabled video for event");
                } catch (err) {
                    console.error("Error removing video role:", err);
                }
            }
            // Additionally, if the user is in the video channel but has no video, move them to the waiting room
            if (newState.channelId === videoChannelId && waitingRoomId) {
                try {
                    await member.voice.setChannel(waitingRoomId);
                    await member.send('⏲️ You have been moved to the waiting room because your video is off!')
                        .catch(() => {});
                } catch (err) {
                    console.error("Error moving member to waiting room:", err);
                }
            }
        }
    }
};
