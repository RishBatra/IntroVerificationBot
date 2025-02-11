// File: events/videocallevent.js
const { Events } = require('discord.js');
const VideoEvent = require('../models/videocallevent');
const videoTimers = new Map();

// A set to flag members that are being auto-promoted from the waiting room.
const autoPromoted = new Set();

/**
 * Polls for the member's voice state to show an active video (either selfVideo or streaming)
 * @param {Guild} guild - The guild object.
 * @param {string} memberId - The ID of the member to check.
 * @param {number} interval - How often to check (in milliseconds).
 * @param {number} timeout - How long to wait in total (in milliseconds).
 * @returns {Promise<boolean>} - Resolves to true if video is active within the timeout, false otherwise.
 */
async function waitForVideoState(guild, memberId, interval = 500, timeout = 2500) {
    const iterations = Math.floor(timeout / interval);
    for (let i = 0; i < iterations; i++) {
        const state = guild.voiceStates.cache.get(memberId);
        if (state && (state.selfVideo || state.streaming)) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    return false;
}

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = newState.guild;
        const eventData = await VideoEvent.findOne({ guildId: guild.id });
        if (!eventData) return;

        const { waitingRoomId, videoChannelId } = eventData;
        const member = newState.member;
        const now = Date.now();

        // Ignore bot-initiated moves and voice updates that don't involve our channels.
        if (member.user.bot) return;
        if (![waitingRoomId, videoChannelId].includes(newState.channelId) &&
            ![waitingRoomId, videoChannelId].includes(oldState.channelId)) return;

        // -------------------------
        // Handle joining the video channel
        // -------------------------
        if (newState.channelId === videoChannelId) {
            // If the member is auto-promoted (i.e. coming from the waiting room)
            if (oldState.channelId === waitingRoomId && autoPromoted.has(member.id)) {
                // Wait 500ms before polling the video state
                setTimeout(async () => {
                    autoPromoted.delete(member.id);
                    // Poll for video state up to 2.5 seconds (500ms intervals)
                    const hasVideo = await waitForVideoState(guild, member.id, 500, 2500);
                    if (!hasVideo) {
                        await member.voice.setChannel(waitingRoomId).catch(console.error);
                        await member.send('📹 Please enable video to join!').catch(() => {});
                        return;
                    }
                    // Clear any existing timer for this member
                    const existingTimer = videoTimers.get(member.id);
                    if (existingTimer) clearTimeout(existingTimer.timer);
                    // Start a new timer for ongoing validation (5 minutes)
                    videoTimers.set(member.id, {
                        timer: setTimeout(async () => {
                            const currentState = guild.voiceStates.cache.get(member.id);
                            if (!currentState || currentState.channelId !== videoChannelId) return;
                            if (!currentState.selfVideo && !currentState.streaming) {
                                await member.voice.setChannel(waitingRoomId).catch(console.error);
                                await member.send('⏲️ Moved to waiting room due to inactive video!').catch(() => {});
                            }
                            videoTimers.delete(member.id);
                        }, 300000), // 300,000ms = 5 minutes
                        lastCheck: Date.now()
                    });
                }, 500);
                return;
            } else {
                // For a normal join to the video channel:
                const hasVideo = newState.selfVideo || newState.streaming;
                if (!hasVideo) {
                    // Only move back if the member is not coming directly from the waiting room.
                    if (oldState.channelId !== waitingRoomId) {
                        await member.voice.setChannel(waitingRoomId).catch(console.error);
                        await member.send('📹 Please enable video to join!').catch(() => {});
                    }
                    return;
                }
                // Clear any existing timer
                const existingTimer = videoTimers.get(member.id);
                if (existingTimer) clearTimeout(existingTimer.timer);
                // Set a new timer for ongoing validation (5 minutes)
                videoTimers.set(member.id, {
                    timer: setTimeout(async () => {
                        const currentState = guild.voiceStates.cache.get(member.id);
                        if (!currentState || currentState.channelId !== videoChannelId) return;
                        if (!currentState.selfVideo && !currentState.streaming) {
                            await member.voice.setChannel(waitingRoomId).catch(console.error);
                            await member.send('⏲️ Moved to waiting room due to inactive video!').catch(() => {});
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
        // Auto-promote from the waiting room if video is enabled
        // -------------------------
        if (newState.channelId === waitingRoomId &&
            (newState.selfVideo || newState.streaming) &&
            oldState.channelId !== videoChannelId) {

            // Avoid rapid state changes with a short cooldown.
            const lastMove = videoTimers.get(member.id)?.lastCheck || 0;
            if (now - lastMove < 3000) return;

            try {
                // Mark this member as auto-promoted.
                autoPromoted.add(member.id);
                await member.voice.setChannel(videoChannelId);
                videoTimers.set(member.id, {
                    timer: setTimeout(async () => {
                        const currentState = guild.voiceStates.cache.get(member.id);
                        if (!currentState || currentState.channelId !== videoChannelId) return;
                        if (!currentState.selfVideo && !currentState.streaming) {
                            await member.voice.setChannel(waitingRoomId).catch(console.error);
                            await member.send('⏲️ Moved to waiting room due to inactive video!').catch(() => {});
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
