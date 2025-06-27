const Intro = require('../models/intro');

// Emoji constants
const EMOJIS = {
    START: '🟢',
    HOLD: '⏸️',
    DENY: '💩'
};

// This function will be called AFTER the existing intro validation passes
async function trackValidIntro(message) {
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
        console.log(`Created intro tracking record for message ${message.id}`);

        // Add emoji reactions
        await addIntroReactions(message);

    } catch (error) {
        console.error('Error tracking valid intro:', error);
    }
}

async function addIntroReactions(message) {
    try {
        await message.react(EMOJIS.START);
        await message.react(EMOJIS.HOLD);
        await message.react(EMOJIS.DENY);
        console.log(`Added emoji reactions to intro message ${message.id}`);
    } catch (error) {
        console.error('Error adding emoji reactions:', error);
    }
}

async function handleIntroReaction(reaction, user) {
    // Skip bot reactions
    if (user.bot) return;

    // Only process reactions in #intros channel
    if (reaction.message.channel.name !== 'intros') return;

    // Check if user has Guardian role
    const guardianRole = reaction.message.guild.roles.cache.find(role => 
        role.name === 'Proud Guardians' || role.name === 'Admins'
    );

    if (!guardianRole || !reaction.message.guild.members.cache.get(user.id).roles.cache.has(guardianRole.id)) {
        // Remove reaction from non-guardian
        await reaction.users.remove(user.id);
        console.log(`Removed reaction from non-guardian user ${user.tag}`);
        return;
    }

    // Find the intro record
    const introRecord = await Intro.findOne({ messageId: reaction.message.id });
    if (!introRecord) {
        console.log(`No intro record found for message ${reaction.message.id}`);
        return;
    }

    try {
        switch (reaction.emoji.name) {
            case EMOJIS.START:
                await handleStartReaction(introRecord, reaction.message);
                break;
            case EMOJIS.HOLD:
                await handleHoldReaction(introRecord, reaction.message);
                break;
            case EMOJIS.DENY:
                await handleDenyReaction(introRecord, reaction.message);
                break;
        }
    } catch (error) {
        console.error('Error handling intro reaction:', error);
    }
}

async function handleStartReaction(introRecord, message) {
    introRecord.status = 'started';
    await introRecord.save();

    // Remove all reactions to clean up the message
    await message.reactions.removeAll();

    console.log(`Intro ${message.id} marked as started by Guardian`);
}

async function handleHoldReaction(introRecord, message) {
    introRecord.status = 'hold';
    introRecord.holdUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    await introRecord.save();

    console.log(`Intro ${message.id} put on hold for 24 hours`);
}

async function handleDenyReaction(introRecord, message) {
    introRecord.status = 'denied';
    await introRecord.save();

    // Remove all reactions
    await message.reactions.removeAll();

    console.log(`Intro ${message.id} marked as denied`);
}

async function checkForReminders() {
    try {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000); // 1 minute ago for testing

        // Find intros that need reminders
        const pendingIntros = await Intro.find({
            status: 'pending',
            createdAt: { $lt: oneMinuteAgo },
            $or: [
                { lastReminderSent: { $exists: false } },
                { lastReminderSent: { $lt: oneMinuteAgo } }
            ]
        });

        const holdExpiredIntros = await Intro.find({
            status: 'hold',
            holdUntil: { $lt: now },
            $or: [
                { lastReminderSent: { $exists: false } },
                { lastReminderSent: { $lt: oneMinuteAgo } }
            ]
        });

        const allIntrosNeedingReminders = [...pendingIntros, ...holdExpiredIntros];

        for (const intro of allIntrosNeedingReminders) {
            await sendReminder(intro);
        }

        if (allIntrosNeedingReminders.length > 0) {
            console.log(`Sent ${allIntrosNeedingReminders.length} reminders for pending intros`);
        }

    } catch (error) {
        console.error('Error checking for reminders:', error);
    }
}

async function sendReminder(introRecord) {
    try {
        // We need to get the guild from the client
        const guild = global.client?.guilds.cache.get(introRecord.guildId);
        if (!guild) {
            console.log(`Guild not found for intro ${introRecord.messageId}`);
            return;
        }

        // Find the reminders channel
        const remindersChannel = guild.channels.cache.find(channel => 
            channel.name === 'intro-reminders'
        );

        if (!remindersChannel) {
            console.log('Intro reminders channel not found');
            return;
        }

        const messageLink = `https://discord.com/channels/${introRecord.guildId}/${introRecord.channelId}/${introRecord.messageId}`;
        
        const reminderMessage = `⏰ This intro needs review: ${messageLink}`;
        
        await remindersChannel.send(reminderMessage);

        // Update last reminder sent
        introRecord.lastReminderSent = new Date();
        await introRecord.save();

        console.log(`Sent reminder for intro ${introRecord.messageId}`);

    } catch (error) {
        console.error('Error sending reminder:', error);
    }
}

module.exports = {
    trackValidIntro,
    handleIntroReaction,
    checkForReminders,
    EMOJIS
}; 