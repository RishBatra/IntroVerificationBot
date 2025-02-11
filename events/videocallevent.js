// File: events/videocallevent.js
const { Events } = require('discord.js');
const VideoEvent = require('../models/videocallevent');
const videoTimers = new Map();

// This set is used to flag members who are being auto-promoted from the waiting room.
// When a member is auto-promoted, we delay the video-check to allow Discord to update the state.
const autoPromoted = new Set();

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = newState.guild;
        const eventData = await VideoEvent.findOne({ guildId: guild.id });
        if (!eventData) return;

        const { waitingRoomId, videoChannelId } = eventData;
        const member = newState.member;
        const now = Date.now();

        // Ignore bot-initiated moves and voice updates that don't involve our two channels.
        if (member.user.bot) return;
        if (![waitingRoomId, videoChannelId].includes(newState.channelId) &&
            ![waitingRoomId, videoChannelId].includes(oldState.channelId)) return;

        // -------------------------
        // Handle joins to the video channel
        // -------------------------
        if (newState.channelId === videoChannelId) {
            // If the member is coming from the waiting room via auto-promotion,
            // delay the video check to let Discord update the state.
            if (oldState.channelId === waitingRoomId && autoPromoted.has(member.id)) {
                setTimeout(async () => {
                    // Remove the flag so that subsequent checks aren’t delayed.
                    autoPromoted.delete(member.id);
                    const updatedState = guild.voiceStates.cache.get(member.id);
                    if (!updatedState) return;
                    const hasVideo = updatedState.selfVideo || updatedState.streaming;
                    if (!hasVideo) {
                        await member.voice.setChannel(waitingRoomId).catch(console.error);
                        await member.send('📹 Please enable video to join!').catch(() => {});
                        return;
                    }
                    // Clear any existing timer for this member
                    const existingTimer = videoTimers.get(member.id);
                    if (existingTimer) clearTimeout(existingTimer.timer);
                    // Start a fresh timer for future state validation
                    videoTimers.set(member.id, {
                        timer: setTimeout(async () => {
                            const currentState = guild.voiceStates.cache.get(member.id);
                            if (!currentState || currentState.channelId !== videoChannelId) return;
                            if (!currentState.selfVideo && !currentState.streaming) {
                                await member.voice.setChannel(waitingRoomId).catch(console.error);
                                member.send('⏲️ Moved to waiting room due to inactive video!').catch(() => {});
                            }
                            videoTimers.delete(member.id);
                        }, 300000), // 5 minutes
                        lastCheck: Date.now()
                    });
                }, 500); // 500ms delay
                return;
            } else {
                // For normal (non-auto-promoted) joins to the video channel:
                const hasVideo = newState.selfVideo || newState.streaming;
                if (!hasVideo) {
                    // Only send the DM if the member wasn’t coming from the waiting room.
                    if (oldState.channelId !== waitingRoomId) {
                        await member.voice.setChannel(waitingRoomId).catch(console.error);
                        await member.send('📹 Please enable video to join!').catch(() => {});
                    }
                    return;
                }
                // Clear any existing timer
                const existingTimer = videoTimers.get(member.id);
                if (existingTimer) clearTimeout(existingTimer.timer);
                // Start a fresh timer to re-validate video state after 5 minutes
                videoTimers.set(member.id, {
                    timer: setTimeout(async () => {
                        const currentState = guild.voiceStates.cache.get(member.id);
                        if (!currentState || currentState.channelId !== videoChannelId) return;
                        if (!currentState.selfVideo && !currentState.streaming) {
                            await member.voice.setChannel(waitingRoomId).catch(console.error);
                            member.send('⏲️ Moved to waiting room due to inactive video!').catch(() => {});
                        }
                        videoTimers.delete(member.id);
                    }, 300000),
                    lastCheck: now
                });
            }
        }

        // -------------------------
        // Handle leaving the video channel
        // -------------------------
        if (oldState.channelId === videoChannelId && newState.channelId !== videoChannelId) {
            const timerData = videoTimers.get(member.id);
            if (timerData) {
                clearTimeout(timerData.timer);
                videoTimers.delete(member.id);
            }
        }

        // -------------------------
        // Auto-promote from waiting room if video is enabled
        // -------------------------
        if (newState.channelId === waitingRoomId &&
            (newState.selfVideo || newState.streaming) &&
            oldState.channelId !== videoChannelId) {

            // Avoid rapid state changes with a short cooldown.
            const lastMove = videoTimers.get(member.id)?.lastCheck || 0;
            if (now - lastMove < 3000) return;

            try {
                // Mark this member as auto-promoted so that we can delay the video check
                autoPromoted.add(member.id);
                await member.voice.setChannel(videoChannelId);
                // Set a timer to validate that video remains enabled.
                videoTimers.set(member.id, {
                    timer: setTimeout(async () => {
                        const currentState = guild.voiceStates.cache.get(member.id);
                        if (!currentState || currentState.channelId !== videoChannelId) return;
                        if (!currentState.selfVideo && !currentState.streaming) {
                            await member.voice.setChannel(waitingRoomId).catch(console.error);
                            member.send('⏲️ Moved to waiting room due to inactive video!').catch(() => {});
                        }
                        videoTimers.delete(member.id);
                    }, 300000),
                    lastCheck: Date.now()
                });
            } catch (error) {
                console.error('Auto-promote failed:', error);
            }
        }
    }
};
