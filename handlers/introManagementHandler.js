const Intro = require('../models/intro');

// Emoji constants
const EMOJIS = {
    START: '🟢',
    HOLD: '⏸️',
    DENY: '🔴'
};

// This function will be called AFTER the existing intro validation passes
async function trackValidIntro(message) {
    console.log(`[INTRO TRACKING] Starting to track intro from ${message.author.tag} (${message.author.id})`);
    console.log(`[INTRO TRACKING] Message ID: ${message.id}, Channel: ${message.channel.name}, Guild: ${message.guild.name}`);
    
    try {
        // Create intro tracking record
        const introRecord = new Intro({
            messageId: message.id,
            channelId: message.channel.id,
            userId: message.author.id,
            guildId: message.guild.id,
            status: 'pending'
        });

        await introRecord.save();
        console.log(`[INTRO TRACKING] ✅ Successfully created intro record for message ${message.id}`);
        console.log(`[INTRO TRACKING] Record details:`, {
            messageId: introRecord.messageId,
            userId: introRecord.userId,
            status: introRecord.status,
            createdAt: introRecord.createdAt
        });

        // Add emoji reactions
        await addIntroReactions(message);

    } catch (error) {
        console.error('[INTRO TRACKING] ❌ Error tracking valid intro:', error);
    }
}

async function addIntroReactions(message) {
    console.log(`[EMOJI REACTIONS] Adding reactions to message ${message.id}`);
    
    try {
        await message.react(EMOJIS.START);
        console.log(`[EMOJI REACTIONS] ✅ Added ${EMOJIS.START} reaction`);
        
        await message.react(EMOJIS.HOLD);
        console.log(`[EMOJI REACTIONS] ✅ Added ${EMOJIS.HOLD} reaction`);
        
        await message.react(EMOJIS.DENY);
        console.log(`[EMOJI REACTIONS] ✅ Added ${EMOJIS.DENY} reaction`);
        
        console.log(`[EMOJI REACTIONS] ✅ Successfully added all emoji reactions to intro message ${message.id}`);
    } catch (error) {
        console.error('[EMOJI REACTIONS] ❌ Error adding emoji reactions:', error);
    }
}

async function handleIntroReaction(reaction, user) {
    console.log(`[REACTION HANDLER] Reaction received: ${reaction.emoji.name} from ${user.tag} (${user.id})`);
    console.log(`[REACTION HANDLER] Message ID: ${reaction.message.id}, Channel: ${reaction.message.channel.name}`);
    
    // Skip bot reactions
    if (user.bot) {
        console.log(`[REACTION HANDLER] Skipping bot reaction from ${user.tag}`);
        return;
    }

    // Only process reactions in #intros channel
    if (reaction.message.channel.name !== 'intros') {
        console.log(`[REACTION HANDLER] Skipping reaction - not in #intros channel`);
        return;
    }

    // Check if user has Guardian role
    const guardianRole = reaction.message.guild.roles.cache.find(role => 
        role.name === 'Proud Guardians' || role.name === 'Admins'
    );

    console.log(`[REACTION HANDLER] Guardian role found:`, guardianRole ? guardianRole.name : 'None');

    if (!guardianRole || !reaction.message.guild.members.cache.get(user.id).roles.cache.has(guardianRole.id)) {
        console.log(`[REACTION HANDLER] ❌ User ${user.tag} does not have Guardian role, removing reaction`);
        // Remove reaction from non-guardian
        await reaction.users.remove(user.id);
        console.log(`[REACTION HANDLER] ✅ Removed reaction from non-guardian user ${user.tag}`);
        return;
    }

    console.log(`[REACTION HANDLER] ✅ User ${user.tag} has Guardian role, processing reaction`);

    // Find the intro record
    const introRecord = await Intro.findOne({ messageId: reaction.message.id });
    if (!introRecord) {
        console.log(`[REACTION HANDLER] ❌ No intro record found for message ${reaction.message.id}`);
        return;
    }

    console.log(`[REACTION HANDLER] Found intro record:`, {
        messageId: introRecord.messageId,
        status: introRecord.status,
        userId: introRecord.userId
    });

    try {
        switch (reaction.emoji.name) {
            case EMOJIS.START:
                console.log(`[REACTION HANDLER] Processing START reaction from ${user.tag}`);
                await handleStartReaction(introRecord, reaction.message);
                break;
            case EMOJIS.HOLD:
                console.log(`[REACTION HANDLER] Processing HOLD reaction from ${user.tag}`);
                await handleHoldReaction(introRecord, reaction.message);
                break;
            case EMOJIS.DENY:
                console.log(`[REACTION HANDLER] Processing DENY reaction from ${user.tag}`);
                await handleDenyReaction(introRecord, reaction.message);
                break;
            default:
                console.log(`[REACTION HANDLER] Unknown emoji reaction: ${reaction.emoji.name}`);
        }
    } catch (error) {
        console.error('[REACTION HANDLER] ❌ Error handling intro reaction:', error);
    }
}

async function handleStartReaction(introRecord, message) {
    console.log(`[START REACTION] Updating intro ${message.id} status to 'started'`);
    
    introRecord.status = 'started';
    await introRecord.save();
    console.log(`[START REACTION] ✅ Updated intro status to 'started'`);

    // Remove all reactions to clean up the message
    await message.reactions.removeAll();
    console.log(`[START REACTION] ✅ Removed all reactions from message ${message.id}`);

    console.log(`[START REACTION] ✅ Intro ${message.id} marked as started by Guardian`);
}

async function handleHoldReaction(introRecord, message) {
    console.log(`[HOLD REACTION] Putting intro ${message.id} on hold for 24 hours`);
    
    introRecord.status = 'hold';
    introRecord.holdUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    await introRecord.save();
    
    console.log(`[HOLD REACTION] ✅ Updated intro status to 'hold'`);
    console.log(`[HOLD REACTION] Hold until: ${introRecord.holdUntil}`);

    console.log(`[HOLD REACTION] ✅ Intro ${message.id} put on hold for 24 hours`);
}

async function handleDenyReaction(introRecord, message) {
    console.log(`[DENY REACTION] Marking intro ${message.id} as denied`);
    
    introRecord.status = 'denied';
    await introRecord.save();
    console.log(`[DENY REACTION] ✅ Updated intro status to 'denied'`);

    // Remove all reactions
    await message.reactions.removeAll();
    console.log(`[DENY REACTION] ✅ Removed all reactions from message ${message.id}`);

    console.log(`[DENY REACTION] ✅ Intro ${message.id} marked as denied`);
}

// Function to handle existing intros in database
async function handleExistingIntros() {
    console.log(`[EXISTING INTROS] Checking for existing intros in database...`);
    
    try {
        const totalIntros = await Intro.countDocuments();
        console.log(`[EXISTING INTROS] Total intros in database: ${totalIntros}`);
        
        if (totalIntros === 0) {
            console.log(`[EXISTING INTROS] No intros found in database`);
            return;
        }

        const allIntros = await Intro.find({});
        console.log(`[EXISTING INTROS] All intros in database:`);
        
        allIntros.forEach((intro, index) => {
            console.log(`[EXISTING INTROS] ${index + 1}. Message ID: ${intro.messageId}`);
            console.log(`[EXISTING INTROS]    Status: ${intro.status}`);
            console.log(`[EXISTING INTROS]    Created: ${intro.createdAt}`);
            console.log(`[EXISTING INTROS]    Last Reminder: ${intro.lastReminderSent || 'None'}`);
            console.log(`[EXISTING INTROS]    Hold Until: ${intro.holdUntil || 'None'}`);
            console.log(`[EXISTING INTROS]    User ID: ${intro.userId}`);
            console.log(`[EXISTING INTROS]    Guild ID: ${intro.guildId}`);
            console.log(`[EXISTING INTROS]    Channel ID: ${intro.channelId}`);
            console.log(`[EXISTING INTROS]    ---`);
        });

        // For testing: Update all existing intros to be eligible for reminders
        const updatedCount = await Intro.updateMany(
            { 
                $or: [
                    { lastReminderSent: { $exists: false } },
                    { lastReminderSent: null }
                ]
            },
            { 
                $set: { 
                    lastReminderSent: new Date(Date.now() - 2 * 60 * 1000) // Set to 2 minutes ago
                }
            }
        );
        
        console.log(`[EXISTING INTROS] Updated ${updatedCount.modifiedCount} intros to be eligible for reminders`);
        
    } catch (error) {
        console.error('[EXISTING INTROS] ❌ Error handling existing intros:', error);
    }
}

async function checkForReminders() {
    console.log(`[REMINDER CHECK] Starting hourly reminder check at ${new Date().toISOString()}`);
    
    try {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000); // 1 minute ago for testing

        console.log(`[REMINDER CHECK] Looking for intros older than: ${oneMinuteAgo.toISOString()}`);
        console.log(`[REMINDER CHECK] Current time: ${now.toISOString()}`);

        // First, let's check how many total intros we have
        const totalIntros = await Intro.countDocuments();
        console.log(`[REMINDER CHECK] Total intros in database: ${totalIntros}`);

        // For testing: Include ALL pending intros regardless of creation time
        const pendingIntros = await Intro.find({
            status: 'pending',
            $or: [
                { lastReminderSent: { $exists: false } },
                { lastReminderSent: null },
                { lastReminderSent: { $lt: oneMinuteAgo } }
            ]
        });

        console.log(`[REMINDER CHECK] Found ${pendingIntros.length} pending intros needing reminders`);
        if (pendingIntros.length > 0) {
            pendingIntros.forEach(intro => {
                console.log(`[REMINDER CHECK] Pending intro: ${intro.messageId}, created: ${intro.createdAt}, lastReminder: ${intro.lastReminderSent || 'None'}`);
            });
        }

        const holdExpiredIntros = await Intro.find({
            status: 'hold',
            $or: [
                { holdUntil: { $lt: now } },
                { holdUntil: null }
            ],
            $or: [
                { lastReminderSent: { $exists: false } },
                { lastReminderSent: null },
                { lastReminderSent: { $lt: oneMinuteAgo } }
            ]
        });

        console.log(`[REMINDER CHECK] Found ${holdExpiredIntros.length} hold-expired intros needing reminders`);
        if (holdExpiredIntros.length > 0) {
            holdExpiredIntros.forEach(intro => {
                console.log(`[REMINDER CHECK] Hold expired intro: ${intro.messageId}, holdUntil: ${intro.holdUntil}, lastReminder: ${intro.lastReminderSent || 'None'}`);
            });
        }

        const allIntrosNeedingReminders = [...pendingIntros, ...holdExpiredIntros];

        console.log(`[REMINDER CHECK] Total intros needing reminders: ${allIntrosNeedingReminders.length}`);

        for (const intro of allIntrosNeedingReminders) {
            console.log(`[REMINDER CHECK] Processing reminder for intro ${intro.messageId} (status: ${intro.status})`);
            await sendReminder(intro);
        }

        if (allIntrosNeedingReminders.length > 0) {
            console.log(`[REMINDER CHECK] ✅ Sent ${allIntrosNeedingReminders.length} reminders for pending intros`);
        } else {
            console.log(`[REMINDER CHECK] No reminders needed at this time`);
        }

    } catch (error) {
        console.error('[REMINDER CHECK] ❌ Error checking for reminders:', error);
    }
}

async function sendReminder(introRecord) {
    console.log(`[SEND REMINDER] Sending reminder for intro ${introRecord.messageId}`);
    
    try {
        // We need to get the guild from the client
        const guild = global.client?.guilds.cache.get(introRecord.guildId);
        if (!guild) {
            console.log(`[SEND REMINDER] ❌ Guild not found for intro ${introRecord.messageId}`);
            console.log(`[SEND REMINDER] Guild ID from record: ${introRecord.guildId}`);
            console.log(`[SEND REMINDER] Available guilds:`, global.client?.guilds.cache.map(g => `${g.name} (${g.id})`));
            return;
        }

        console.log(`[SEND REMINDER] Found guild: ${guild.name} (${guild.id})`);

        // List all channels in the guild for debugging
        console.log(`[SEND REMINDER] All channels in guild:`, guild.channels.cache.map(ch => `${ch.name} (${ch.type})`));

        // Find the reminders channel
        const remindersChannel = guild.channels.cache.find(channel => 
            channel.name === 'intro-reminders'
        );

        if (!remindersChannel) {
            console.log(`[SEND REMINDER] ❌ Intro reminders channel not found in guild ${guild.name}`);
            console.log(`[SEND REMINDER] Looking for channel name: 'intro-reminders'`);
            console.log(`[SEND REMINDER] Available text channels:`, guild.channels.cache.filter(ch => ch.type === 0).map(ch => ch.name));
            return;
        }

        console.log(`[SEND REMINDER] Found reminders channel: #${remindersChannel.name} (${remindersChannel.id})`);

        const messageLink = `https://discord.com/channels/${introRecord.guildId}/${introRecord.channelId}/${introRecord.messageId}`;
        
        const reminderMessage = `⏰ This intro needs review: ${messageLink}`;
        
        console.log(`[SEND REMINDER] Sending message: ${reminderMessage}`);
        
        await remindersChannel.send(reminderMessage);

        // Update last reminder sent
        introRecord.lastReminderSent = new Date();
        await introRecord.save();

        console.log(`[SEND REMINDER] ✅ Successfully sent reminder for intro ${introRecord.messageId}`);
        console.log(`[SEND REMINDER] Updated lastReminderSent to: ${introRecord.lastReminderSent}`);

    } catch (error) {
        console.error('[SEND REMINDER] ❌ Error sending reminder:', error);
    }
}

module.exports = {
    trackValidIntro,
    handleIntroReaction,
    checkForReminders,
    handleExistingIntros,
    EMOJIS
}; 