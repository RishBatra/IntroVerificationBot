const { EmbedBuilder } = require('discord.js');
const IntroEditWindow = require('../models/introEditWindow');
const { startWindowUntil, endWindow } = require('./introEditWindowManager');

const INTRO_CHANNEL_ID = '692965776545546261';
const ADMIN_SPAM_CHANNEL_NAME = 'admins-spam';

async function removeIntroChannelOverwrite(client, guildId, userId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        return;
    }

    const introsChannel = guild.channels.cache.get(INTRO_CHANNEL_ID) ||
        guild.channels.cache.find(channel => channel.name === 'intros');
    if (!introsChannel) {
        return;
    }

    await introsChannel.permissionOverwrites.delete(userId).catch(() => null);
}

async function notifyWindowEnded(client, userId, endedByStaff = false) {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(endedByStaff ? 0x22c55e : 0xff6b6b)
        .setTitle(endedByStaff ? 'Intro edit window closed' : 'Intro edit window ended')
        .setDescription(
            endedByStaff
                ? 'Your temporary access to edit/repost in #intros has been ended by staff.'
                : 'Your temporary access to edit/repost in #intros has expired. If you still need access, ask staff to run `/editintro` again.'
        )
        .setTimestamp();

    await user.send({ embeds: [embed] }).catch(() => null);
}

async function sendAdminSpamLog(client, guildId, content) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        return;
    }

    const adminSpamChannel = guild.channels.cache.find(channel => channel.name === ADMIN_SPAM_CHANNEL_NAME);
    if (!adminSpamChannel) {
        return;
    }

    await adminSpamChannel.send(content).catch(() => null);
}

function scheduleWindow(client, guildId, userId, expiresAt, startedBy = null) {
    return startWindowUntil(
        guildId,
        userId,
        expiresAt,
        async () => {
            const currentWindow = await IntroEditWindow.findOne({ guildId, userId });
            const effectiveStartedBy = currentWindow?.startedBy || startedBy || null;

            await removeIntroChannelOverwrite(client, guildId, userId);
            await IntroEditWindow.findOneAndUpdate(
                { guildId, userId },
                {
                    $set: {
                        status: 'expired',
                        updatedAt: new Date()
                    }
                }
            );
            await notifyWindowEnded(client, userId, false);
            await sendAdminSpamLog(
                client,
                guildId,
                `✅ Intro edit window ended for <@${userId}>${effectiveStartedBy ? ` (started by <@${effectiveStartedBy}>)` : ''}.`
            );
        }
    );
}

async function upsertAndScheduleWindow({ client, guildId, userId, expiresAt, startedBy }) {
    await IntroEditWindow.findOneAndUpdate(
        { guildId, userId },
        {
            $set: {
                guildId,
                userId,
                expiresAt,
                status: 'active',
                startedBy: startedBy || null,
                endedBy: null,
                updatedAt: new Date()
            },
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        { upsert: true }
    );

    return scheduleWindow(client, guildId, userId, expiresAt, startedBy || null);
}

async function endWindowAndPersist({ client, guildId, userId, endedBy }) {
    const existingWindow = await IntroEditWindow.findOne({ guildId, userId });

    endWindow(guildId, userId);
    await removeIntroChannelOverwrite(client, guildId, userId);

    await IntroEditWindow.findOneAndUpdate(
        { guildId, userId },
        {
            $set: {
                status: 'ended',
                endedBy: endedBy || null,
                updatedAt: new Date()
            }
        }
    );

    await notifyWindowEnded(client, userId, true);
    await sendAdminSpamLog(
        client,
        guildId,
        `✅ Intro edit window manually ended for <@${userId}> by <@${endedBy}>${existingWindow?.startedBy ? ` (started by <@${existingWindow.startedBy}>)` : ''}.`
    );
}

async function rehydrateIntroEditWindows(client) {
    const now = new Date();
    const windows = await IntroEditWindow.find({ status: 'active' });

    for (const window of windows) {
        if (window.expiresAt.getTime() <= now.getTime()) {
            await removeIntroChannelOverwrite(client, window.guildId, window.userId);
            await IntroEditWindow.findOneAndUpdate(
                { guildId: window.guildId, userId: window.userId },
                {
                    $set: {
                        status: 'expired',
                        updatedAt: new Date()
                    }
                }
            );
            await notifyWindowEnded(client, window.userId, false);
            continue;
        }

        scheduleWindow(client, window.guildId, window.userId, window.expiresAt, window.startedBy || null);
    }
}

module.exports = {
    upsertAndScheduleWindow,
    endWindowAndPersist,
    rehydrateIntroEditWindows,
    sendAdminSpamLog
};
