const { PermissionFlagsBits } = require('discord.js');

const NO_MUTE_CHANNEL_ID = '693018400259047444'; // Replace with actual channel ID
const INACTIVITY_THRESHOLD = 60000; // 1 minute of inactivity
const CHECK_INTERVAL = 5000; // Check every 5 seconds

const userLastSpoke = new Map();
const userCheckIntervals = new Map();

function setupVoiceActivityMonitor(client) {
    client.on('voiceStateUpdate', handleVoiceStateUpdate);
    client.on('guildMemberSpeaking', handleGuildMemberSpeaking);
}

function handleVoiceStateUpdate(oldState, newState) {
    if (newState.channelId === NO_MUTE_CHANNEL_ID && oldState.channelId !== NO_MUTE_CHANNEL_ID) {
        // User joined the no-mute channel
        console.log(`User ${newState.member.user.tag} joined the no-mute channel`);
        startActivityCheck(newState.member);
    } else if (oldState.channelId === NO_MUTE_CHANNEL_ID && newState.channelId !== NO_MUTE_CHANNEL_ID) {
        // User left the no-mute channel
        console.log(`User ${oldState.member.user.tag} left the no-mute channel`);
        stopActivityCheck(oldState.member);
    }
}

function handleGuildMemberSpeaking(member, speaking) {
    if (speaking && member.voice.channelId === NO_MUTE_CHANNEL_ID) {
        userLastSpoke.set(member.id, Date.now());
    }
}

function startActivityCheck(member) {
    console.log(`Starting activity check for ${member.user.tag}`);
    if (userCheckIntervals.has(member.id)) {
        clearInterval(userCheckIntervals.get(member.id));
    }
    userLastSpoke.set(member.id, Date.now()); // Set initial speaking time
    const interval = setInterval(() => checkMemberActivity(member), CHECK_INTERVAL);
    userCheckIntervals.set(member.id, interval);
}

function stopActivityCheck(member) {
    console.log(`Stopping activity check for ${member.user.tag}`);
    if (userCheckIntervals.has(member.id)) {
        clearInterval(userCheckIntervals.get(member.id));
        userCheckIntervals.delete(member.id);
    }
    userLastSpoke.delete(member.id);
}

async function checkMemberActivity(member) {
    const voiceState = member.voice;
    if (!voiceState.channelId || voiceState.channelId !== NO_MUTE_CHANNEL_ID) {
        console.log(`${member.user.tag} is no longer in the no-mute channel`);
        stopActivityCheck(member);
        return;
    }

    const now = Date.now();
    const lastSpoke = userLastSpoke.get(member.id) || 0;

    if (voiceState.selfMute || (now - lastSpoke > INACTIVITY_THRESHOLD)) {
        console.log(`Disconnecting ${member.user.tag} due to ${voiceState.selfMute ? 'being muted' : 'inactivity'}`);
        try {
            await member.voice.disconnect();
            await member.send('You were disconnected from the no-mute channel due to inactivity or being muted.');
        } catch (error) {
            console.error('Error disconnecting member from no-mute channel:', error);
        }
        stopActivityCheck(member);
    }
}

module.exports = { setupVoiceActivityMonitor };