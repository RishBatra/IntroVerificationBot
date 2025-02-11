// File: events/videocallevent.js
const { Events } = require('discord.js');
const VideoEvent = require('../models/videocallevent');
const videoTimers = new Map();

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = newState.guild;
        const eventData = await VideoEvent.findOne({ guildId: guild.id });
        if (!eventData) return;

        const { waitingRoomId, videoChannelId } = eventData;
        const member = newState.member;
        const now = Date.now();

        // Ignore bot-initiated moves and non-event channels
        if (member.user.bot) return;
        if (![waitingRoomId, videoChannelId].includes(newState.channelId) &&
            ![waitingRoomId, videoChannelId].includes(oldState.channelId)) return;

        // Handle video channel joins
        if (newState.channelId === videoChannelId) {
            // Immediate strict video check for all entries
            const hasVideo = newState.selfVideo || newState.streaming;
            if (!hasVideo) {
                if (oldState.channelId !== waitingRoomId) {
                    await member.voice.setChannel(waitingRoomId)
                        .catch(console.error);
                    await member.send('📹 Please enable video to join!')
                        .catch(() => {});
                }
                return;
            }

            // Clear any existing timer for this member
            const existingTimer = videoTimers.get(member.id);
            if (existingTimer) clearTimeout(existingTimer.timer);

            // Start a fresh timer to validate video activity after 5 minutes
            videoTimers.set(member.id, {
                timer: setTimeout(async () => {
                    const currentState = guild.voiceStates.cache.get(member.id);
                    if (!currentState || currentState.channelId !== videoChannelId) return;
                    
                    if (!currentState.selfVideo && !currentState.streaming) {
                        await member.voice.setChannel(waitingRoomId)
                            .catch(console.error);
                        member.send('⏲️ Moved to waiting room due to inactive video!')
                            .catch(() => {});
                    }
                    videoTimers.delete(member.id);
                }, 300000),
                lastCheck: now
            });
        }

        // Handle leaving the video channel by clearing any active timers
        if (oldState.channelId === videoChannelId && newState.channelId !== videoChannelId) {
            const timerData = videoTimers.get(member.id);
            if (timerData) {
                clearTimeout(timerData.timer);
                videoTimers.delete(member.id);
            }
        }

        // Auto-promote a member from the waiting room if they have video enabled
        if (newState.channelId === waitingRoomId &&
            (newState.selfVideo || newState.streaming) &&
            oldState.channelId !== videoChannelId) {
            
            // Check for a short cooldown to avoid rapid state changes
            const lastMove = videoTimers.get(member.id)?.lastCheck || 0;
            if (now - lastMove < 3000) return;

            try {
                // Removed: await guild.voiceStates.fetch(member.id);
                // Discord automatically updates voice states, so fetching isn't necessary.

                await member.voice.setChannel(videoChannelId);
                videoTimers.set(member.id, {
                    timer: setTimeout(async () => {
                        const currentState = guild.voiceStates.cache.get(member.id);
                        if (!currentState || currentState.channelId !== videoChannelId) return;
                        
                        if (!currentState.selfVideo && !currentState.streaming) {
                            await member.voice.setChannel(waitingRoomId)
                                .catch(console.error);
                            member.send('⏲️ Moved to waiting room due to inactive video!')
                                .catch(() => {});
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
