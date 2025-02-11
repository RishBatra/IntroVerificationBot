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

        // Define (or create) the role that grants access to the video channel
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
                // Allow members with the video role to view and connect
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

        // When a member joins the video channel, delay the check to allow the voice state to update
        if (newState.channelId === videoChannelId) {
            setTimeout(async () => {
                const freshState = guild.voiceStates.cache.get(member.id);
                if (!freshState) return;
                const videoActive = freshState.selfVideo || freshState.streaming;
                if (videoActive) {
                    // If video is active, add the role if not already present
                    if (!member.roles.cache.has(videoRole.id)) {
                        try {
                            await member.roles.add(videoRole, "User enabled video for event");
                        } catch (err) {
                            console.error("Error adding video role:", err);
                        }
                    }
                } else {
                    // If video is not active, remove the role (if it exists)
                    if (member.roles.cache.has(videoRole.id)) {
                        try {
                            await member.roles.remove(videoRole, "User disabled video for event");
                        } catch (err) {
                            console.error("Error removing video role:", err);
                        }
                    }
                    // And move the member back to the waiting room (if defined)
                    if (waitingRoomId) {
                        try {
                            await member.voice.setChannel(waitingRoomId);
                            await member.send('⏲️ You have been moved to the waiting room because your video is off!')
                                .catch(() => {});
                        } catch (err) {
                            console.error("Error moving member to waiting room:", err);
                        }
                    }
                }
            }, 1000); // 1-second delay
        } else {
            // For other channel changes, process immediately
            const videoActive = newState.selfVideo || newState.streaming;
            if (videoActive) {
                if (!member.roles.cache.has(videoRole.id)) {
                    try {
                        await member.roles.add(videoRole, "User enabled video for event");
                    } catch (err) {
                        console.error("Error adding video role:", err);
                    }
                }
            } else {
                if (member.roles.cache.has(videoRole.id)) {
                    try {
                        await member.roles.remove(videoRole, "User disabled video for event");
                    } catch (err) {
                        console.error("Error removing video role:", err);
                    }
                }
            }
        }
    }
};
