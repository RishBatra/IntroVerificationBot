const { PermissionFlagsBits } = require('discord.js');

const NO_MUTE_CHANNEL_ID = 'your_no_mute_channel_id'; // ID for no mute channel
const MUTED_CHANNEL_ID = 'your_muted_channel_id'; // ID for AFK channel 
const INACTIVITY_THRESHOLD = 60000; // 1 minute of inactivity
const CHECK_INTERVAL = 5000; // Check every 5 seconds

const userLastSpoke = new Map();
const userCheckIntervals = new Map();

function setupVoiceActivityMonitor(client) {
    client.on('voiceStateUpdate', handleVoiceStateUpdate);
    client.on('guildMemberSpeaking', handleGuildMemberSpeaking);
}

function handleVoiceStateUpdate(oldState, newState) {
    if (newState.channelId === NO_MUTE_CHANNEL_ID) {
        startActivityCheck(newState.member);
    } else if (oldState.channelId === NO_MUTE_CHANNEL_ID && newState.channelId !== NO_MUTE_CHANNEL_ID) {
        stopActivityCheck(oldState.member);
    }
}

function handleGuildMemberSpeaking(member, speaking) {
    if (speaking && member.voice.channelId === NO_MUTE_CHANNEL_ID) {
        userLastSpoke.set(member.id, Date.now());
    }
}

function startActivityCheck(member) {
    if (userCheckIntervals.has(member.id)) {
        clearInterval(userCheckIntervals.get(member.id));
    }

    const interval = setInterval(() => checkMemberActivity(member), CHECK_INTERVAL);
    userCheckIntervals.set(member.id, interval);
}

function stopActivityCheck(member) {
    if (userCheckIntervals.has(member.id)) {
        clearInterval(userCheckIntervals.get(member.id));
        userCheckIntervals.delete(member.id);
    }
    userLastSpoke.delete(member.id);
}

async function checkMemberActivity(member) {
    const voiceState = member.voice;
    if (!voiceState.channelId || voiceState.channelId !== NO_MUTE_CHANNEL_ID) {
        stopActivityCheck(member);
        return;
    }

    const now = Date.now();
    const lastSpoke = userLastSpoke.get(member.id) || 0;

    if (voiceState.selfMute || (now - lastSpoke > INACTIVITY_THRESHOLD)) {
        try {
            const mutedChannel = await member.guild.channels.fetch(MUTED_CHANNEL_ID);
            if (mutedChannel && member.voice.channel) {
                await member.voice.setChannel(mutedChannel);
                await member.send('You were moved to the muted channel due to inactivity or being muted in the no-mute channel.');
            }
        } catch (error) {
            console.error('Error moving member to muted channel:', error);
        }
        stopActivityCheck(member);
    }
}

module.exports = { setupVoiceActivityMonitor };