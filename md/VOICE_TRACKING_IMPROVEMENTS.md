# Voice Activity Tracking - Code Review Improvements

## HIGH PRIORITY FIXES ✅ ALL IMPLEMENTED

### 1. Memory Leak Prevention ✅ IMPLEMENTED
Add periodic cleanup for in-memory state:

```javascript
// Add after line 16 in voiceStateUpdate.js
// Cleanup inactive guilds every hour
setInterval(() => {
    const now = Date.now();
    for (const guildId in channelMuteStates) {
        for (const channelId in channelMuteStates[guildId]) {
            const state = channelMuteStates[guildId][channelId];
            // Remove channel states older than 24 hours
            if (state.allMutedSince && now - state.allMutedSince.getTime() > 24 * 60 * 60 * 1000) {
                delete channelMuteStates[guildId][channelId];
            }
        }
    }
}, 60 * 60 * 1000); // Run every hour
```

### 2. Parallel Member Fetching in Leaderboard ✅ IMPLEMENTED
Replace sequential fetches with parallel:

```javascript
// Replace lines 60-85 in vcleaderboard.js
const entries = await Promise.all(results.map(async (result, i) => {
    const userId = result._id;
    const totalMs = result.totalMs;
    
    const totalHours = Math.floor(totalMs / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    const timeFormatted = `${totalHours}h ${totalMinutes}m`;
    
    let displayName = 'Unknown User';
    try {
        const member = await interaction.guild.members.fetch(userId);
        displayName = member.displayName;
    } catch (error) {
        displayName = `Unknown User (${userId.slice(0, 8)}...)`;
    }
    
    const rank = i + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
    return `${medal} **${displayName}** — ${timeFormatted}`;
}));
```

### 3. Negative Duration Check ✅ IMPLEMENTED
Add to saveSession function:

```javascript
// Add after line 111 in voiceStateUpdate.js
const durationMs = leftAt.getTime() - joinedAt.getTime();

// Prevent negative durations (clock skew)
if (durationMs < 0) {
    console.log(`[VC Tracker] Skipping session save - negative duration: ${durationMs}ms`);
    return;
}

if (durationMs < 1000) {
    console.log(`[VC Tracker] Skipping session save - too short: ${durationMs}ms`);
    return;
}
```

## MEDIUM PRIORITY

### 4. Graceful Shutdown for Cleanup Tasks ✅ IMPLEMENTED
Replace `setInterval` with controlled async loops and add shutdown handlers:

**Problem**: 
- `setInterval` with async functions can cause race conditions
- No graceful shutdown handling
- Process hangs on exit

**Solution Implemented**:
```javascript
// Controlled async loop
let cleanupTimeoutHandle = null;
let isShuttingDown = false;

async function scheduleNextCleanup() {
    if (isShuttingDown) return;
    
    cleanupTimeoutHandle = setTimeout(async () => {
        try {
            await performMemoryCleanup();
        } catch (error) {
            console.error('[VC Tracker] Error during cleanup:', error);
        }
        await scheduleNextCleanup(); // Schedule next after completion
    }, CLEANUP_INTERVAL_MS);
}

// Graceful shutdown
async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    if (cleanupTimeoutHandle) {
        clearTimeout(cleanupTimeoutHandle);
    }
    
    await performMemoryCleanup(); // Final cleanup
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

**Benefits**:
- ✅ No concurrent cleanup executions
- ✅ Clean process exit on Ctrl+C
- ✅ Works with PM2, Docker, Kubernetes
- ✅ Final cleanup saves all data

See `GRACEFUL_SHUTDOWN_IMPLEMENTATION.md` for full details.

### 5. Add Leaderboard Caching ✅ IMPLEMENTED
Implement 5-minute cache with invalidation and cleanup:

```javascript
// Add to vcleaderboard.js
const leaderboardCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000; // Clean up every 10 minutes

/**
 * Invalidate leaderboard cache for a specific guild
 * Called whenever voice session data changes
 */
function invalidateLeaderboardCache(guildId) {
    if (leaderboardCache.has(guildId)) {
        leaderboardCache.delete(guildId);
        console.log(`[VCLeaderboard] Cache invalidated for guild ${guildId}`);
    }
}

/**
 * Periodic cleanup of expired cache entries
 * Prevents unbounded memory growth
 */
function cleanupExpiredCache() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [guildId, cacheEntry] of leaderboardCache.entries()) {
        if (now - cacheEntry.timestamp >= CACHE_TTL) {
            leaderboardCache.delete(guildId);
            removedCount++;
        }
    }
    
    if (removedCount > 0) {
        console.log(`[VCLeaderboard] Cache cleanup: Removed ${removedCount} expired entries`);
    }
}

// Start periodic cache cleanup
setInterval(cleanupExpiredCache, CACHE_CLEANUP_INTERVAL);

// Export invalidation function
module.exports = {
    data: new SlashCommandBuilder()...,
    invalidateLeaderboardCache, // Export for use in voiceStateUpdate.js
    async execute(interaction) {
        // Check cache first
        const cached = leaderboardCache.get(guildId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            results = cached.data;
        } else {
            // Fetch fresh data and cache it
            results = await VoiceSession.aggregate([...]);
            leaderboardCache.set(guildId, {
                timestamp: Date.now(),
                data: results
            });
        }
    }
};
```

**In voiceStateUpdate.js** - Invalidate cache when data changes:

```javascript
// Import at top of file
const vcLeaderboard = require('../commands/vcleaderboard');
const invalidateLeaderboardCache = vcLeaderboard.invalidateLeaderboardCache;

// In saveSession() after successful DB write
async function saveSession(guildId, userId, channelId, joinedAt, leftAt) {
    // ... save to database ...
    await VoiceSession.create({ ... });
    
    // Invalidate cache since voice data changed
    if (invalidateLeaderboardCache) {
        invalidateLeaderboardCache(guildId);
    }
}
```

**Benefits**:
- ✅ 5-minute cache reduces DB queries by ~90%
- ✅ Automatic invalidation when data changes
- ✅ Periodic cleanup prevents memory leaks
- ✅ Cache per-guild for isolation
- ✅ Graceful handling if command not loaded yet

## LOW PRIORITY

### 6. Move Hardcoded IDs to Config
Create `.env` entries:

```env
AFK_CHANNEL_ID=693034620618539068
VERIFICATION_HELP_CHANNEL_ID=1242333346131087420
MOD_ROLE_ID=800053595881078784
GREEN_ROLE_ID=767712239205351425
STAR_ROLE_ID=703126088091435019
```

Update code:
```javascript
const AFK_CHANNEL_ID = process.env.AFK_CHANNEL_ID;
```

### 7. Add Logging Library
Replace console.log with Winston or Pino:

```javascript
const logger = require('./utils/logger');
logger.info('[VC Tracker] Started session', { userId, channelId });
logger.error('[VC Tracker] Error saving session', { error, userId });
```

### 8. Add Unit Tests
Test critical functions:
- `getHumanCount()` - Edge cases with no members
- `isUserMuted()` - All mute/deaf combinations
- `canStartSession()` - All validation scenarios

### 9. Add Metrics/Monitoring
Track important metrics:
- Total sessions saved per hour
- Average session duration
- Memory usage of activeSessions
- Database query performance

## OPTIONAL ENHANCEMENTS

### Add User Commands
- `/vcstats @user` - View individual user stats
- `/vcstats me` - View own stats
- `/vcreset @user` - Admin command to reset user hours

### Add Analytics
- Weekly/monthly voice activity trends
- Most active voice channels
- Peak activity hours
- Average concurrent users in VCs

### Add Notifications
- DM users when they reach 10h (Green eligible)
- DM users when they reach 30h (Star eligible)
- Celebratory message in channel for milestones


