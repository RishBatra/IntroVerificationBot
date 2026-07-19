const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const Queue = require('../models/queue');
const QueueMember = require('../models/queueMember');

const ADMIN_ROLE_NAMES = ['Admins', 'Proud Guardians'];
const VERIFIED_ROLE_NAME = 'Verified';
const MAX_DISPLAYED_MEMBERS = 25;

function isQueueAdmin(member) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    return member.roles.cache.some(role => ADMIN_ROLE_NAMES.includes(role.name));
}

// Member commands (join/leave/positions) require the Verified role; admins bypass
function isVerifiedMember(member) {
    if (isQueueAdmin(member)) return true;
    return member.roles.cache.some(role => role.name === VERIFIED_ROLE_NAME);
}

const NOT_VERIFIED_MESSAGE = 'Only verified members can use queues. Complete verification first!';

// Pulling is allowed for admins and anyone connected to the queue's linked voice channel
function canPull(member, queue) {
    if (isQueueAdmin(member)) return true;
    return Boolean(queue.voiceChannelId && member.voice?.channelId === queue.voiceChannelId);
}

const COLORS = {
    success: 0x2ecc71,
    error: 0xe74c3c,
    info: 0x9b59b6,
};

function makeEmbed(description, { color = 'info', title = null } = {}) {
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setColor(COLORS[color] ?? color);
    if (title) embed.setTitle(title);
    return embed;
}

function embedReply(interaction, description, { color = 'info', title = null, ephemeral = true } = {}) {
    return interaction.reply({ embeds: [makeEmbed(description, { color, title })], ephemeral });
}

function getSortedMembers(queueId) {
    return QueueMember.find({ queueId }).sort({ priority: -1, joinedAt: 1 });
}

async function findQueue(guildId, name) {
    return Queue.findOne({ guildId, name });
}

// If the guild has exactly one queue, a name is optional in commands
async function resolveQueue(interaction, nameOption = 'queue') {
    const name = interaction.options.getString(nameOption);
    if (name) {
        const queue = await findQueue(interaction.guild.id, name);
        return { queue, error: queue ? null : `No queue named **${name}** found.` };
    }
    const queues = await Queue.find({ guildId: interaction.guild.id });
    if (queues.length === 0) return { queue: null, error: 'No queues exist yet. An admin can create one with `/queues add`.' };
    if (queues.length === 1) return { queue: queues[0], error: null };
    return { queue: null, error: `There are multiple queues — please specify one: ${queues.map(q => `**${q.name}**`).join(', ')}` };
}

async function queueNameAutocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const queues = await Queue.find({ guildId: interaction.guild.id }).limit(25);
    const choices = queues
        .filter(q => q.name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(q => ({ name: q.name, value: q.name }));
    await interaction.respond(choices);
}

async function buildDisplay(queue) {
    const members = await getSortedMembers(queue._id);

    const lines = members.slice(0, MAX_DISPLAYED_MEMBERS).map((m, i) => `**${i + 1}.** <@${m.userId}>`);
    if (members.length > MAX_DISPLAYED_MEMBERS) {
        lines.push(`*...and ${members.length - MAX_DISPLAYED_MEMBERS} more*`);
    }

    const embed = new EmbedBuilder()
        .setTitle(`🎤 ${queue.name}`)
        .setColor(queue.locked ? 0xe74c3c : 0x9b59b6)
        .setDescription(lines.length ? lines.join('\n') : '*The queue is empty — hit Join to get in line!*')
        .setTimestamp();

    const footerParts = [`${members.length}${queue.size ? `/${queue.size}` : ''} in queue`];
    if (queue.rotation) footerParts.push('Rotation on: singers rejoin at the back after their turn');
    if (queue.locked) footerParts.push('🔒 Locked');
    embed.setFooter({ text: footerParts.join(' • ') });

    if (queue.lastPulledUserId) {
        embed.addFields({ name: 'Now up', value: `<@${queue.lastPulledUserId}>` });
    }
    const nextUp = members[0];
    if (nextUp && nextUp.userId !== queue.lastPulledUserId) {
        embed.addFields({ name: 'Next up', value: `<@${nextUp.userId}>` });
    }
    if (queue.voiceChannelId) {
        embed.addFields({ name: 'Voice channel', value: `🔊 <#${queue.voiceChannelId}>` });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`queue_join:${queue._id}`)
            .setLabel('Join')
            .setStyle(ButtonStyle.Success)
            .setDisabled(queue.locked),
        new ButtonBuilder()
            .setCustomId(`queue_leave:${queue._id}`)
            .setLabel('Leave')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`queue_pull:${queue._id}`)
            .setLabel('Pull Next')
            .setStyle(ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [row] };
}

// Debounce display refreshes so button-mashing doesn't hammer the Discord API
const pendingRefreshes = new Map();

function scheduleDisplayRefresh(client, queueId) {
    const key = String(queueId);
    if (pendingRefreshes.has(key)) return;
    pendingRefreshes.set(key, setTimeout(async () => {
        pendingRefreshes.delete(key);
        try {
            await refreshDisplay(client, queueId);
        } catch (error) {
            console.error(`Error refreshing queue display ${key}:`, error);
        }
    }, 1000));
}

async function refreshDisplay(client, queueId) {
    const queue = await Queue.findById(queueId);
    if (!queue || !queue.displayChannelId || !queue.displayMessageId) return;

    let channel;
    try {
        channel = await client.channels.fetch(queue.displayChannelId);
    } catch {
        return;
    }

    try {
        const message = await channel.messages.fetch(queue.displayMessageId);
        await message.edit(await buildDisplay(queue));
    } catch (error) {
        // Display message was deleted; forget it so /show can recreate it
        if (error.code === 10008) {
            await Queue.updateOne({ _id: queue._id }, { displayMessageId: null });
        } else {
            throw error;
        }
    }
}

// Posts (or re-posts) the display message in the given channel
async function postDisplay(queue, channel) {
    // Delete the old display so there's only ever one live message
    if (queue.displayChannelId && queue.displayMessageId) {
        try {
            const oldChannel = await channel.client.channels.fetch(queue.displayChannelId);
            const oldMessage = await oldChannel.messages.fetch(queue.displayMessageId);
            await oldMessage.delete();
        } catch {
            // Old message already gone
        }
    }

    const message = await channel.send(await buildDisplay(queue));
    queue.displayChannelId = channel.id;
    queue.displayMessageId = message.id;
    await queue.save();
    return message;
}

// Returns { ok, message } — shared by /join and the Join button
async function joinQueue(client, queue, userId) {
    if (queue.locked) {
        return { ok: false, message: `**${queue.name}** is locked right now.` };
    }

    if (queue.size) {
        const count = await QueueMember.countDocuments({ queueId: queue._id });
        if (count >= queue.size) {
            return { ok: false, message: `**${queue.name}** is full (${queue.size} max).` };
        }
    }

    try {
        await QueueMember.create({ queueId: queue._id, guildId: queue.guildId, userId });
    } catch (error) {
        if (error.code === 11000) {
            return { ok: false, message: `You're already in **${queue.name}**.` };
        }
        throw error;
    }

    const position = await QueueMember.countDocuments({ queueId: queue._id });
    scheduleDisplayRefresh(client, queue._id);
    return { ok: true, message: `You joined **${queue.name}** at position **#${position}**. 🎤` };
}

// Returns { ok, message } — shared by /leave and the Leave button
async function leaveQueue(client, queue, userId) {
    const result = await QueueMember.deleteOne({ queueId: queue._id, userId });
    if (result.deletedCount === 0) {
        return { ok: false, message: `You're not in **${queue.name}**.` };
    }
    scheduleDisplayRefresh(client, queue._id);
    return { ok: true, message: `You left **${queue.name}**.` };
}

// Called from voiceStateUpdate: when a user leaves a queue's linked voice
// channel, drop them from that queue (and clear "Now up" if it was them).
async function handleVoiceLeave(client, guildId, userId, channelId) {
    const queues = await Queue.find({ guildId, voiceChannelId: channelId });

    for (const queue of queues) {
        let changed = false;

        const result = await QueueMember.deleteOne({ queueId: queue._id, userId });
        if (result.deletedCount > 0) changed = true;

        if (queue.lastPulledUserId === userId) {
            queue.lastPulledUserId = null;
            await queue.save();
            changed = true;
        }

        if (changed) {
            console.log(`[Queue] Removed ${userId} from "${queue.name}" (left voice channel)`);
            scheduleDisplayRefresh(client, queue._id);
        }
    }
}

// Sticky behavior: when someone chats in a channel that has a live queue
// display, re-post the display at the bottom. Throttled per channel so
// busy chat doesn't cause a delete/send storm.
const STICKY_REPOST_DELAY_MS = 3000;
const pendingStickyReposts = new Map();

async function handleStickyDisplay(message) {
    const channelId = message.channel.id;
    if (pendingStickyReposts.has(channelId)) return;

    const hasDisplay = await Queue.exists({ displayChannelId: channelId, displayMessageId: { $ne: null } });
    if (!hasDisplay) return;

    pendingStickyReposts.set(channelId, setTimeout(async () => {
        pendingStickyReposts.delete(channelId);
        try {
            const queues = await Queue.find({ displayChannelId: channelId, displayMessageId: { $ne: null } });
            for (const queue of queues) {
                await postDisplay(queue, message.channel);
            }
        } catch (error) {
            console.error(`Error re-sticking queue display in channel ${channelId}:`, error);
        }
    }, STICKY_REPOST_DELAY_MS));
}

// Pulls the next member. In rotation mode (karaoke) they rejoin at the back.
// Returns the pulled member doc or null if the queue is empty.
async function pullNext(client, queue) {
    const next = await QueueMember.findOne({ queueId: queue._id }).sort({ priority: -1, joinedAt: 1 });
    if (!next) return null;

    if (queue.rotation) {
        next.joinedAt = new Date();
        next.priority = 0;
        await next.save();
    } else {
        await QueueMember.deleteOne({ _id: next._id });
    }

    queue.lastPulledUserId = next.userId;
    await queue.save();
    scheduleDisplayRefresh(client, queue._id);
    return next;
}

// Builds the public pull announcement. Mentions go in `content` (mentions
// inside embeds don't trigger a ping), the pretty part is the embed.
function buildPullAnnouncement(queue, userIds) {
    const lines = userIds.map(userId =>
        queue.pullMessage
            ? queue.pullMessage.replaceAll('{user}', `<@${userId}>`)
            : `You're up, <@${userId}>!`
    );

    const embed = new EmbedBuilder()
        .setTitle(`🎤 ${queue.name} — Next up!`)
        .setDescription(lines.join('\n'))
        .setColor(COLORS.info)
        .setTimestamp();
    if (queue.rotation) {
        embed.setFooter({ text: "You'll rejoin at the back of the line after your turn" });
    }

    return { content: userIds.map(id => `<@${id}>`).join(' '), embeds: [embed] };
}

module.exports = {
    isQueueAdmin,
    isVerifiedMember,
    canPull,
    NOT_VERIFIED_MESSAGE,
    makeEmbed,
    embedReply,
    getSortedMembers,
    findQueue,
    resolveQueue,
    queueNameAutocomplete,
    buildDisplay,
    scheduleDisplayRefresh,
    refreshDisplay,
    postDisplay,
    handleStickyDisplay,
    handleVoiceLeave,
    joinQueue,
    leaveQueue,
    pullNext,
    buildPullAnnouncement,
};
