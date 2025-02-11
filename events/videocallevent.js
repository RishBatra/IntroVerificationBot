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

        // Handle video channel activity
        if (newState.channelId === videoChannelId) {
            // Check if user came from waiting room
            const fromWaitingRoom = oldState.channelId === waitingRoomId;
            
            // Immediate video check for non-waiting room entries
            if (!fromWaitingRoom) {
                const hasVideo = newState.selfVideo || newState.streaming;
                if (!hasVideo) {
                    await member.voice.setChannel(waitingRoomId)
                        .catch(console.error);
                    return member.send('📹 Please enable video to join this channel!')
                        .catch(() => {/* Prevent unhandled promise rejection */});
                }
            }

            // Start/reset the 5-minute timer
            const existingTimer = videoTimers.get(member.id);
            if (existingTimer) clearTimeout(existingTimer.timer);

            videoTimers.set(member.id, {
                timer: setTimeout(async () => {
                    const currentState = await guild.members.fetch(member.id)
                        .then(m => m.voice)
                        .catch(() => null);
                    
                    if (!currentState || currentState.channelId !== videoChannelId) return;
                    
                    if (!currentState.selfVideo && !currentState.streaming) {
                        await member.voice.setChannel(waitingRoomId)
                            .catch(console.error);
                        member.send('⏲️ Moved to waiting room due to inactive video!')
                            .catch(() => {});
                    }
                    videoTimers.delete(member.id);
                }, 300000), // 5 minutes
                lastCheck: now
            });
        }

        // Handle leaving video channel
        if (oldState.channelId === videoChannelId && newState.channelId !== videoChannelId) {
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
            
            // Prevent rapid toggling
            const lastMove = videoTimers.get(member.id)?.lastCheck || 0;
            if (now - lastMove < 5000) return; // 5-second cooldown

            await member.voice.setChannel(videoChannelId)
                .catch(console.error);
        }
    }
};
