const VoiceSession = require('../models/voiceSession');
const VideoEvent = require('../models/videocallevent');
const Whitelist = require('../models/whitelist');

// Constants
const AFK_CHANNEL_ID = '693034620618539068';
const MUTE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MIN_HUMAN_COUNT = 2;

// In-memory session state
// activeSessions[guildId][userId] = { channelId, joinedAt, isMuted, muteStartAt }
const activeSessions = {};

// Channel-wide mute state tracking
// channelMuteStates[guildId][channelId] = { mutedUserIds: Set, allMutedSince: Date|null }
const channelMuteStates = {};

/**
 * Count human (non-bot) users in a voice channel
 */
function getHumanCount(channel) {
    if (!channel || !channel.members) return 0;
    return channel.members.filter(m => !m.user.bot).size;
}

/**
 * Check if a user is muted or deafened
 */
function isUserMuted(voiceState) {
    return voiceState.selfMute || voiceState.selfDeaf || 
           voiceState.serverMute || voiceState.serverDeaf;
}

/**
 * Get all human users in a channel who are muted
 */
function getMutedHumans(channel) {
    if (!channel || !channel.members) return [];
    return channel.members.filter(m => 
        !m.user.bot && isUserMuted(m.voice)
    ).map(m => m.id);
}

/**
 * Initialize guild session storage if needed
 */
function ensureGuildStorage(guildId) {
    if (!activeSessions[guildId]) {
        activeSessions[guildId] = {};
    }
    if (!channelMuteStates[guildId]) {
        channelMuteStates[guildId] = {};
    }
}

/**
 * Initialize channel mute state if needed
 */
function ensureChannelMuteState(guildId, channelId) {
    ensureGuildStorage(guildId);
    if (!channelMuteStates[guildId][channelId]) {
        channelMuteStates[guildId][channelId] = {
            mutedUserIds: new Set(),
            allMutedSince: null
        };
    }
}

/**
 * Update channel-wide mute state and check if all humans are muted
 */
function updateChannelMuteState(channel) {
    if (!channel) return;
    
    const guildId = channel.guild.id;
    const channelId = channel.id;
    ensureChannelMuteState(guildId, channelId);
    
    const humanMembers = channel.members.filter(m => !m.user.bot);
    const mutedHumanIds = getMutedHumans(channel);
    
    const state = channelMuteStates[guildId][channelId];
    state.mutedUserIds = new Set(mutedHumanIds);
    
    // Check if ALL humans in channel are muted
    if (humanMembers.size > 0 && mutedHumanIds.length === humanMembers.size) {
        // All humans are muted
        if (!state.allMutedSince) {
            state.allMutedSince = new Date();
            console.log(`[VC Tracker] All users muted in channel ${channel.name} (${channelId})`);
        }
    } else {
        // At least one human is unmuted
        state.allMutedSince = null;
    }
}

/**
 * Check if channel-wide mute timeout has been exceeded
 */
function isChannelMuteTimeoutExceeded(guildId, channelId) {
    const state = channelMuteStates[guildId]?.[channelId];
    if (!state || !state.allMutedSince) return false;
    
    const elapsed = Date.now() - state.allMutedSince.getTime();
    return elapsed >= MUTE_TIMEOUT_MS;
}

/**
 * Save a completed session to MongoDB
 */
async function saveSession(guildId, userId, channelId, joinedAt, leftAt) {
    const durationMs = leftAt.getTime() - joinedAt.getTime();
    
    // Only save if duration is positive and meaningful (at least 1 second)
    if (durationMs < 1000) {
        console.log(`[VC Tracker] Skipping session save - too short: ${durationMs}ms`);
        return;
    }
    
    try {
        await VoiceSession.create({
            guildId,
            userId,
            channelId,
            joinedAt,
            leftAt,
            durationMs
        });
        
        const hours = (durationMs / (1000 * 60 * 60)).toFixed(2);
        console.log(`[VC Tracker] Saved session: ${userId} - ${hours}h`);
    } catch (error) {
        console.error('[VC Tracker] Error saving session:', error);
    }
}

/**
 * End a user's active session
 */
async function endSession(guildId, userId, reason = 'unknown') {
    ensureGuildStorage(guildId);
    const session = activeSessions[guildId][userId];
    
    if (!session) return;
    
    const leftAt = new Date();
    console.log(`[VC Tracker] Ending session for ${userId}: ${reason}`);
    
    await saveSession(guildId, userId, session.channelId, session.joinedAt, leftAt);
    delete activeSessions[guildId][userId];
}

/**
 * Check if a user can start a valid session in a channel
 */
function canStartSession(channel, userId) {
    if (!channel) return false;
    
    // Check if AFK channel
    if (channel.id === AFK_CHANNEL_ID) {
        return false;
    }
    
    // Check human count
    const humanCount = getHumanCount(channel);
    if (humanCount < MIN_HUMAN_COUNT) {
        return false;
    }
    
    // Check if channel is in full mute timeout
    if (isChannelMuteTimeoutExceeded(channel.guild.id, channel.id)) {
        return false;
    }
    
    return true;
}

/**
 * Start a new session for a user
 */
function startSession(guildId, userId, channelId, voiceState) {
    ensureGuildStorage(guildId);
    
    const isMuted = isUserMuted(voiceState);
    const session = {
        channelId,
        joinedAt: new Date(),
        isMuted,
        muteStartAt: isMuted ? new Date() : null
    };
    
    activeSessions[guildId][userId] = session;
    console.log(`[VC Tracker] Started session for ${userId} in ${channelId} (muted: ${isMuted})`);
}

/**
 * End all sessions in a channel
 */
async function endAllSessionsInChannel(channel, reason) {
    const guildId = channel.guild.id;
    ensureGuildStorage(guildId);
    
    const userIds = Object.keys(activeSessions[guildId]).filter(
        uid => activeSessions[guildId][uid].channelId === channel.id
    );
    
    for (const userId of userIds) {
        await endSession(guildId, userId, reason);
    }
}

/**
 * Check for individual mute timeouts
 */
async function checkMuteTimeouts(guildId) {
    ensureGuildStorage(guildId);
    const now = Date.now();
    
    for (const [userId, session] of Object.entries(activeSessions[guildId])) {
        if (session.isMuted && session.muteStartAt) {
            const elapsed = now - session.muteStartAt.getTime();
            if (elapsed >= MUTE_TIMEOUT_MS) {
                await endSession(guildId, userId, 'mute timeout exceeded');
            }
        }
    }
}

// ========================================
// VIDEO CALL EVENT HANDLER
// ========================================
/**
 * Handle video call event logic (from videocallevent.js)
 */
async function handleVideoCallEvent(oldState, newState) {
    try {
        // Get video event configuration
        const videoEvent = await VideoEvent.findOne({ guildId: newState.guild.id });
        
        // If no video event exists, exit early
        if (!videoEvent) return;

        // Now we know there's a video event, let's check if this update involves video channels
        const isOldChannelVideo = oldState.channel && [videoEvent.waitingRoomId, videoEvent.videoChannelId].includes(oldState.channelId);
        const isNewChannelVideo = newState.channel && [videoEvent.waitingRoomId, videoEvent.videoChannelId].includes(newState.channelId);

        // Only process if either channel is a video event channel
        if (!isOldChannelVideo && !isNewChannelVideo) return;

        console.log(`[VideoEvent] Processing video channel update for ${newState.member.user.tag}`);

        const videoVerifiedRole = newState.guild.roles.cache.get(videoEvent.videoVerifiedRoleId);
        if (!videoVerifiedRole) {
            console.error(`[VideoEvent] Video Verified role not found`);
            return;
        }

        const voiceTextManager = newState.client.voiceTextManager;
        const guild = newState.guild;

        // Use newState.channel if available; otherwise, fallback to oldState.channel.
        const currentChannel = newState.channel || oldState.channel;
        if (!currentChannel) {
            console.log(`[VideoEvent] No channel available in voice state update.`);
            return;
        }
        
        // ***************** Video Event Logic Only *****************
        if (videoEvent) {
            console.log(`[VideoEvent] Video event configured and channel is in Video Events category.`);
            const waitingRoomId = videoEvent.waitingRoomId;
            const videoChannelId = videoEvent.videoChannelId;

            const isWhitelisted = await Whitelist.findOne({ guildId: guild.id, userId: newState.member.id });
            if (isWhitelisted) {
                console.log(`[VideoEvent] Member ${newState.member.id} is whitelisted. Skipping video event logic.`);
                return;
            }

            const updateRole = async (member, add) => {
                try {
                    if (add) {
                        if (!member.roles.cache.has(videoVerifiedRole.id)) {
                            await member.roles.add(videoVerifiedRole);
                            console.log(`[VideoEvent] Added videoVerifiedRole to ${member.id}`);
                        }
                    } else {
                        if (member.roles.cache.has(videoVerifiedRole.id)) {
                            await member.roles.remove(videoVerifiedRole);
                            console.log(`[VideoEvent] Removed videoVerifiedRole from ${member.id}`);
                        }
                    }
                } catch (error) {
                    console.error(`[VideoEvent] Failed to update role for ${member.user.tag}: ${error}`);
                }
            };

            // When a member joins the waiting room channel.
            if (newState.channelId === waitingRoomId) {
                console.log(`[VideoEvent] Member ${newState.member.id} joined Waiting Room (${waitingRoomId}).`);
                if (newState.selfVideo) {
                    await updateRole(newState.member, true);
                } else {
                    await updateRole(newState.member, false);
                }
            }

            // When a member joins the video channel, set a timeout for further actions.
            if (newState.channelId === videoChannelId) {
                console.log(`[VideoEvent] Member ${newState.member.id} joined Video Channel (${videoChannelId}).`);
                setTimeout(async () => {
                    const updatedState = guild.members.cache.get(newState.member.id)?.voice;
                    if (!updatedState || updatedState.channelId !== videoChannelId || updatedState.selfVideo) {
                        console.log(`[VideoEvent] Member ${newState.member.id} did not stay in Video Channel or is sharing video; no further action.`);
                        return;
                    }
                    console.log(`[VideoEvent] Moving member ${newState.member.id} to Waiting Room (${waitingRoomId}) and updating roles.`);
                    await newState.member.voice.setChannel(waitingRoomId);
                    await updateRole(newState.member, false);
                    
                    // Purge messages if the linked text channel is no longer in use.
                    if (voiceTextManager) {
                        voiceTextManager.channelCooldowns.delete(newState.channelId);
                        const textChannel = await voiceTextManager.getOrCreateTextChannel(currentChannel);
                        if (textChannel && currentChannel.members.size === 0) {
                            console.log(`[VideoEvent] Purging messages for text channel ${textChannel.id}.`);
                            await voiceTextManager.purgeChannelMessages(textChannel);
                        }
                    }
                }, videoEvent.timeoutDuration || 10000);
            }
        }
    } catch (error) {
        console.error('[VideoEvent] Error processing voice state update:', error);
    }
}

// ========================================
// VOICE-TEXT CHANNEL HANDLER
// ========================================
/**
 * Handle voice-text channel visibility (from voiceTextUpdate.js)
 */
async function handleVoiceTextChannels(oldState, newState) {
    try {
        // Check if this is a video event channel - if so, skip voice-text management
        const videoEvent = await VideoEvent.findOne({ guildId: newState.guild.id });
        if (videoEvent) {
            const isOldChannelVideo = oldState.channel && [videoEvent.waitingRoomId, videoEvent.videoChannelId].includes(oldState.channelId);
            const isNewChannelVideo = newState.channel && [videoEvent.waitingRoomId, videoEvent.videoChannelId].includes(newState.channelId);
            
            // Skip if either channel is a video event channel
            if (isOldChannelVideo || isNewChannelVideo) return;
        }

        const voiceTextManager = newState.client.voiceTextManager;
        if (!voiceTextManager) return;

        // Handle member leaving a voice channel
        if (oldState.channel && oldState.channel !== newState.channel) {
            console.log(`[VoiceTextUpdate] Member ${oldState.member.user.tag} left ${oldState.channel.name}`);
            await voiceTextManager.updateTextChannelVisibility(
                oldState.channel,
                oldState.member,
                false
            );
        }

        // Handle member joining a voice channel
        if (newState.channel && oldState.channel !== newState.channel) {
            console.log(`[VoiceTextUpdate] Member ${newState.member.user.tag} joined ${newState.channel.name}`);
            await voiceTextManager.updateTextChannelVisibility(
                newState.channel,
                newState.member,
                true
            );
        }
    } catch (error) {
        console.error('[VoiceTextUpdate] Error:', error);
    }
}

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        try {
            const userId = newState.id;
            const guildId = newState.guild.id;
            
            // Ignore bots
            if (newState.member.user.bot) return;
            
            const oldChannel = oldState.channel;
            const newChannel = newState.channel;
            
            // ========================================
            // SECTION 1: VIDEO CALL EVENT HANDLER
            // ========================================
            await handleVideoCallEvent(oldState, newState);
            
            // ========================================
            // SECTION 2: VOICE-TEXT CHANNEL MANAGER
            // ========================================
            await handleVoiceTextChannels(oldState, newState);
            
            // ========================================
            // SECTION 3: VC ACTIVITY TRACKING
            // ========================================
            
            // User left voice entirely
            if (oldChannel && !newChannel) {
                await endSession(guildId, userId, 'left voice');
                
                // Update channel mute state
                if (oldChannel.id !== AFK_CHANNEL_ID) {
                    updateChannelMuteState(oldChannel);
                    
                    // Check if channel now has too few humans
                    if (getHumanCount(oldChannel) < MIN_HUMAN_COUNT) {
                        await endAllSessionsInChannel(oldChannel, 'channel below minimum humans');
                    }
                }
                return;
            }
            
            // User joined voice
            if (!oldChannel && newChannel) {
                // Update channel mute state first
                if (newChannel.id !== AFK_CHANNEL_ID) {
                    updateChannelMuteState(newChannel);
                }
                
                // Try to start session
                if (canStartSession(newChannel, userId)) {
                    startSession(guildId, userId, newChannel.id, newState);
                }
                return;
            }
            
            // User moved channels
            if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
                // End session in old channel
                await endSession(guildId, userId, 'moved channels');
                
                // Update old channel mute state
                if (oldChannel.id !== AFK_CHANNEL_ID) {
                    updateChannelMuteState(oldChannel);
                    
                    // Check if old channel now has too few humans
                    if (getHumanCount(oldChannel) < MIN_HUMAN_COUNT) {
                        await endAllSessionsInChannel(oldChannel, 'channel below minimum humans');
                    }
                }
                
                // Update new channel mute state
                if (newChannel.id !== AFK_CHANNEL_ID) {
                    updateChannelMuteState(newChannel);
                }
                
                // Try to start session in new channel
                if (canStartSession(newChannel, userId)) {
                    startSession(guildId, userId, newChannel.id, newState);
                }
                return;
            }
            
            // User stayed in same channel but mute/deaf state changed
            if (newChannel && oldChannel && oldChannel.id === newChannel.id) {
                const wasUserMuted = isUserMuted(oldState);
                const isNowMuted = isUserMuted(newState);
                
                // Update channel mute state
                if (newChannel.id !== AFK_CHANNEL_ID) {
                    updateChannelMuteState(newChannel);
                }
                
                ensureGuildStorage(guildId);
                const session = activeSessions[guildId][userId];
                
                // User muted
                if (!wasUserMuted && isNowMuted) {
                    if (session) {
                        session.isMuted = true;
                        session.muteStartAt = new Date();
                        console.log(`[VC Tracker] User ${userId} muted`);
                    }
                }
                
                // User unmuted
                if (wasUserMuted && !isNowMuted) {
                    if (session) {
                        session.isMuted = false;
                        session.muteStartAt = null;
                        console.log(`[VC Tracker] User ${userId} unmuted`);
                    } else {
                        // User unmuted but has no session - try to start one
                        if (canStartSession(newChannel, userId)) {
                            startSession(guildId, userId, newChannel.id, newState);
                        }
                    }
                }
                
                // Check for channel-wide mute timeout
                if (isChannelMuteTimeoutExceeded(guildId, newChannel.id)) {
                    await endAllSessionsInChannel(newChannel, 'channel-wide mute timeout');
                }
                
                // Check for individual mute timeouts
                await checkMuteTimeouts(guildId);
            }
            
        } catch (error) {
            console.error('[VC Tracker] Error in voiceStateUpdate:', error);
        }
    }
};

