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

    // Get the member object to check roles
    const member = reaction.message.guild.members.cache.get(user.id);
    if (!member) {
        console.log(`[REACTION HANDLER] ❌ Could not find member object for user ${user.tag}`);
        return;
    }

    // Check for Guardian roles
    const proudGuardiansRole = reaction.message.guild.roles.cache.find(role => role.name === 'Proud Guardians');
    const adminRole = reaction.message.guild.roles.cache.find(role => role.name === 'Admins');

    console.log(`[REACTION HANDLER] Proud Guardians role found:`, proudGuardiansRole ? proudGuardiansRole.name : 'None');
    console.log(`[REACTION HANDLER] Admins role found:`, adminRole ? adminRole.name : 'None');
    console.log(`[REACTION HANDLER] User roles:`, member.roles.cache.map(role => role.name));

    // Check if user has either Guardian role
    const hasProudGuardians = proudGuardiansRole && member.roles.cache.has(proudGuardiansRole.id);
    const hasAdmin = adminRole && member.roles.cache.has(adminRole.id);
    const hasGuardianRole = hasProudGuardians || hasAdmin;

    console.log(`[REACTION HANDLER] User has Proud Guardians: ${hasProudGuardians}`);
    console.log(`[REACTION HANDLER] User has Admin: ${hasAdmin}`);
    console.log(`[REACTION HANDLER] User has Guardian role: ${hasGuardianRole}`);

    if (!hasGuardianRole) {
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

    // Start verification process
    try {
        await startVerificationProcess(introRecord, message);
    } catch (error) {
        console.error('[START REACTION] ❌ Error starting verification process:', error);
    }

    console.log(`[START REACTION] ✅ Intro ${message.id} marked as started by Guardian`);
}

async function startVerificationProcess(introRecord, message) {
    console.log(`[VERIFICATION] Starting verification process for user ${introRecord.userId}`);
    
    try {
        const guild = global.client.guilds.cache.get(introRecord.guildId);
        if (!guild) {
            console.log(`[VERIFICATION] ❌ Guild not found for intro ${introRecord.messageId}`);
            return;
        }

        const targetUser = await global.client.users.fetch(introRecord.userId);
        if (!targetUser) {
            console.log(`[VERIFICATION] ❌ Target user not found: ${introRecord.userId}`);
            return;
        }

        // Find verification-help channel
        const verificationHelpChannel = guild.channels.cache.find(channel => channel.name === 'verification-help');
        if (!verificationHelpChannel) {
            console.log(`[VERIFICATION] ❌ Verification-help channel not found`);
            return;
        }

        // Find message-list channel
        const messageListChannel = guild.channels.cache.find(channel => channel.name === 'message-list');
        if (!messageListChannel) {
            console.log(`[VERIFICATION] ❌ Message-list channel not found`);
            return;
        }

        // Check if user already has an active verification thread
        const existingThreads = await verificationHelpChannel.threads.fetchActive();
        const existingThread = existingThreads.threads.find(thread => 
            thread.name === `Verification - ${targetUser.tag}`
        );

        if (existingThread) {
            console.log(`[VERIFICATION] ⚠️ User ${targetUser.tag} already has an active verification thread`);
            return;
        }

        // Send message in message-list channel
        const executorNick = "Guardian"; // Since we don't have the specific guardian info
        const targetNick = targetUser.username;
        
        await messageListChannel.send(`A Guardian is messaging <@${targetUser.id}> (${targetNick})`);
        console.log(`[VERIFICATION] ✅ Sent message to message-list channel`);

        // Create a private thread in verification-help
        const thread = await verificationHelpChannel.threads.create({
            name: `Verification - ${targetUser.tag}`,
            autoArchiveDuration: 10080,  // 7 days
            reason: 'Verification process started via reaction',
        });

        console.log(`[VERIFICATION] ✅ Created verification thread: ${thread.name}`);

        // Fetch and delete the initial system message
        const starterMessage = await thread.fetchStarterMessage();
        if (starterMessage && starterMessage.system) {
            await starterMessage.delete();
        }

        // Add members to thread
        await thread.members.add(targetUser.id);
        console.log(`[VERIFICATION] ✅ Added target user to thread`);

        // Send verification questions
        const greetings = [
            `Hello <@${targetUser.id}>, I am a Guardian and I will be helping you with verification today.`,
            `Hi <@${targetUser.id}>, I am a Guardian, here to assist you with your verification.`,
            `Greetings <@${targetUser.id}>, I am a Guardian, and I will guide you through the verification process.`
        ];

        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

        const { EmbedBuilder } = require('discord.js');
        const verificationQuestions = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Verification Questions')
            .setDescription(`${randomGreeting}\n\nPlease answer the following questions:`)
            .addFields(
                { name: '1.', value: 'Where did you find the server and why do you want to join it?' },
                { name: '2.', value: 'Are you seeking support or guidance regarding your confusion about your sexuality, or are you looking for a community to connect with?' },
                { name: '3.', value: 'What are your expectations from our LGBTQIA+ server, and how do you think it can benefit you?' },
                { name: '4.', value: 'Are you open to learning and respecting the experiences and identities of others within the LGBTQIA+ community?' }
            )
            .setFooter({ text: 'Please refrain from answering in one word or small phrases.' });

        // Send and pin the verification questions
        const questionMessage = await thread.send({ embeds: [verificationQuestions] });
        await questionMessage.pin();
        console.log(`[VERIFICATION] ✅ Sent and pinned verification questions`);

        console.log(`[VERIFICATION] ✅ Verification process completed for user ${targetUser.tag}`);

    } catch (error) {
        console.error('[VERIFICATION] ❌ Error in verification process:', error);
        throw error;
    }
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

        // Only check hold-expired intros (holdUntil has passed)
        const holdExpiredIntros = await Intro.find({
            status: 'hold',
            holdUntil: { $lt: now }, // Only intros where hold time has expired
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