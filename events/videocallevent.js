const { Events } = require('discord.js');
const VideoEvent = require('../models/videocallevent');
const videoTimers = new Map();
const promotionDelays = new Map();

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = newState.guild;
        
        // Get event channels from DB
        const eventData = await VideoEvent.findOne({ guildId: guild.id });
        if (!eventData) return;

        const { waitingRoomId, videoChannelId } = eventData;
        const member = newState.member;

        // Clear any existing promotion delay timer
        const existingDelay = promotionDelays.get(member.id);
        if (existingDelay) {
            clearTimeout(existingDelay);
            promotionDelays.delete(member.id);
        }

        // Handle video channel join
        if (newState.channelId === videoChannelId) {
            const hasVideo = newState.selfVideo || newState.streaming;
            
            // Immediate check when joining video channel
            if (!hasVideo) {
                try {
                    await member.voice.setChannel(waitingRoomId);
                    await member.send('📹 Please enable your video to join!');
                    return;
                } catch (error) {
                    console.error('Error moving user to waiting room:', error);
                    return;
                }
            }

            // Start 5-minute timer for continuous monitoring
            const timer = setTimeout(async () => {
                const currentState = guild.members.cache.get(member.id)?.voice;
                if (currentState?.channelId === videoChannelId && 
                   !currentState.selfVideo && 
                   !currentState.streaming) {
                    await member.voice.setChannel(waitingRoomId);
                    await member.send('⏲️ Moved to waiting room due to inactive video!');
                }
                videoTimers.delete(member.id);
            }, 300000);

            videoTimers.set(member.id, timer);
        }

        // Handle leaving video channel
        if (oldState.channelId === videoChannelId && newState.channelId !== videoChannelId) {
            const timer = videoTimers.get(member.id);
            if (timer) {
                clearTimeout(timer);
                videoTimers.delete(member.id);
            }
        }

        // Auto-promote from waiting room with a small delay
        if (newState.channelId === waitingRoomId && 
           (newState.selfVideo || newState.streaming)) {
            const delayTimer = setTimeout(async () => {
                const currentState = guild.members.cache.get(member.id)?.voice;
                if (currentState?.channelId === waitingRoomId) {
                    // Double check if video is still enabled
                    if (currentState.selfVideo || currentState.streaming) {
                        try {
                            await member.voice.setChannel(videoChannelId);
                        } catch (error) {
                            console.error('Error moving user to video channel:', error);
                        }
                    }
                }
                promotionDelays.delete(member.id);
            }, 1500); // Increased to 1.5 seconds for more reliable checking

            promotionDelays.set(member.id, delayTimer);
        }
    }
};
