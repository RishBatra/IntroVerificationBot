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

        // Ignore state changes not involving our channels
        if (![waitingRoomId, videoChannelId].includes(newState.channelId) && 
            ![waitingRoomId, videoChannelId].includes(oldState.channelId)) return;

        // Handle video channel joins
        if (newState.channelId === videoChannelId) {
            // Immediate video check for ALL entries
            const hasVideo = newState.selfVideo || newState.streaming;
            if (!hasVideo) {
                // Prevent infinite loops
                if (oldState.channelId !== waitingRoomId) {
                    await member.voice.setChannel(waitingRoomId)
                        .catch(console.error);
                    await member.send('📹 Please enable video to join this channel!')
                        .catch(() => {});
                }
                return;
            }

            // Start/reset the 5-minute timer
            const existingTimer = videoTimers.get(member.id);
            if (existingTimer) clearTimeout(existingTimer.timer);

            videoTimers.set(member.id, {
                timer: setTimeout(async () => {
                    const currentState = guild.members.cache.get(member.id)?.voice;
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

        // Handle leaving video channel
        if (oldState.channelId === videoChannelId) {
            const timerData = videoTimers.get(member.id);
            if (timerData) {
                clearTimeout(timerData.timer);
                videoTimers.delete(member.id);
            }
        }

        // Auto-promote from waiting room with video
        if (newState.channelId === waitingRoomId && 
            (newState.selfVideo || newState.streaming) &&
            oldState.channelId !== videoChannelId) {
            
            // Add cooldown and track movement
            const lastMove = videoTimers.get(member.id)?.lastCheck || 0;
            if (now - lastMove < 3000) return;

            try {
                await member.voice.setChannel(videoChannelId);
                // Update timer with new timestamp
                videoTimers.set(member.id, {
                    timer: setTimeout(async () => {
                        const currentState = guild.members.cache.get(member.id)?.voice;
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
