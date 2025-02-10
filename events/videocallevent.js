const { Events } = require('discord.js');
const VideoEvent = require('../models/videocallevent');
const videoTimers = new Map();

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = newState.guild;
        
        // Get event channels from DB
        const eventData = await VideoEvent.findOne({ guildId: guild.id });
        if (!eventData) return;

        const { waitingRoomId, videoChannelId } = eventData;
        const member = newState.member;

        // Handle video channel join
        if (newState.channelId === videoChannelId) {
            if (!newState.selfVideo && !newState.streaming) {
                await member.voice.setChannel(waitingRoomId);
                await member.send('📹 Please enable your video to join!');
                return;
            }

            // Start 5-minute timer
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

        // Auto-promote from waiting room
        if (newState.channelId === waitingRoomId && 
           (newState.selfVideo || newState.streaming)) {
            await member.voice.setChannel(videoChannelId);
        }
    }
};
