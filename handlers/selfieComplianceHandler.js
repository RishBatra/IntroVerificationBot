const { EmbedBuilder } = require('discord.js');
const SelfiePost = require('../models/selfiePost');
const SelfieCompliance = require('../models/selfieCompliance');
const SelfieComplianceConfig = require('../models/selfieComplianceConfig');

const PHOTO_VERIFIED_ROLE_ID = '907912045817634846';
const PHOTO_VERIFIED_ROLE_NAME = 'Photo Verified';
const ADMIN_SPAM_CHANNEL_NAME = 'admins-spam';
const SELFIES_CHANNEL_NAME = 'selfies';

const SCAN_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const INACTIVITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days without a selfie
const DM_DELAY_MS = 24 * 60 * 60 * 1000; // DM if still inactive 24h after public warning
const REVOKE_DELAY_MS = 48 * 60 * 60 * 1000; // revoke at 48h into grace
const POLL_INTERVAL_MS = 15 * 60 * 1000; // process due actions every 15 minutes

const COLORS = {
    success: 0x2ECC71,
    warning: 0xF39C12,
    alert: 0xE67E22,
    danger: 0xE74C3C,
    info: 0x3498DB
};

function guildIcon(guild) {
    return guild.iconURL({ size: 128 }) || undefined;
}

function brandFooter(guild, text) {
    return {
        text: text ? `${text} • ${guild.name}` : guild.name,
        iconURL: guildIcon(guild)
    };
}

function chunkMentions(members, limit = 1024) {
    const mentions = members.map(member => `<@${member.id}>`);
    if (mentions.length === 0) return '_None_';

    const chunks = [];
    let current = '';
    for (const mention of mentions) {
        const next = current ? `${current} ${mention}` : mention;
        if (next.length > limit) {
            chunks.push(current);
            current = mention;
        } else {
            current = next;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

function buildPublicWarningEmbed(guild, members, selfiesChannel) {
    const mentionChunks = chunkMentions(members);
    const channelRef = selfiesChannel ? `<#${selfiesChannel.id}>` : `#${SELFIES_CHANNEL_NAME}`;
    const embed = new EmbedBuilder()
        .setColor(COLORS.warning)
        .setAuthor({
            name: 'Photo Verification • Reminder',
            iconURL: guildIcon(guild)
        })
        .setTitle('Reminder: post in selfies')
        .setDescription(
            `Hey! Members with **${PHOTO_VERIFIED_ROLE_NAME}** should post a selfie in ${channelRef} at least once every **30 days**.\n\n` +
            `If that's you, please drop one soon so you can keep access.`
        )
        .addFields({
            name: `Still need to post (${members.length})`,
            value: mentionChunks[0]
        })
        .setTimestamp()
        .setFooter(brandFooter(guild, 'Photo verification'));

    for (let i = 1; i < mentionChunks.length; i++) {
        embed.addFields({
            name: 'Still need to post (continued)',
            value: mentionChunks[i]
        });
    }

    return embed;
}

function buildAllClearEmbed(guild) {
    return new EmbedBuilder()
        .setColor(COLORS.success)
        .setAuthor({
            name: 'Photo Verification • Compliance Scan',
            iconURL: guildIcon(guild)
        })
        .setTitle('All clear')
        .setDescription(
            `Every **${PHOTO_VERIFIED_ROLE_NAME}** member has posted a static selfie in #${SELFIES_CHANNEL_NAME} within the last **30 days**.`
        )
        .addFields({
            name: 'Next scan',
            value: 'About **30 days** from now',
            inline: true
        })
        .setThumbnail(guildIcon(guild))
        .setTimestamp()
        .setFooter(brandFooter(guild, 'Selfie compliance'));
}

function buildScanReportEmbed(guild, newlyFlagged, alreadyInGrace) {
    const formatList = (members) =>
        members.map(member => `• <@${member.id}> — \`${member.user.tag}\``).join('\n') || '_None_';

    return new EmbedBuilder()
        .setColor(newlyFlagged.length > 0 ? COLORS.warning : COLORS.info)
        .setAuthor({
            name: 'Photo Verification • Compliance Scan',
            iconURL: guildIcon(guild)
        })
        .setTitle('Scan complete')
        .setDescription(
            `Checked **${PHOTO_VERIFIED_ROLE_NAME}** members for selfie activity in the last **30 days**.`
        )
        .addFields(
            {
                name: 'Pipeline',
                value: '🟠 Public warning → 📩 DM at 24h → 🚫 Revoke at 48h',
                inline: false
            },
            {
                name: `Newly flagged · ${newlyFlagged.length}`,
                value: formatList(newlyFlagged).slice(0, 1024),
                inline: true
            },
            {
                name: `Already in grace · ${alreadyInGrace.length}`,
                value: formatList(alreadyInGrace).slice(0, 1024),
                inline: true
            },
            {
                name: 'Public warning',
                value: newlyFlagged.length > 0
                    ? `Posted in #${SELFIES_CHANNEL_NAME}`
                    : 'Skipped (no new flags)',
                inline: false
            }
        )
        .setThumbnail(guildIcon(guild))
        .setTimestamp()
        .setFooter(brandFooter(guild, 'Next scan in ~30 days'));
}

function buildDmWarningEmbed(guild, hoursLeft) {
    const selfiesChannel = guild.channels.cache.find(c => c.name === SELFIES_CHANNEL_NAME);
    const channelRef = selfiesChannel ? `<#${selfiesChannel.id}>` : `#${SELFIES_CHANNEL_NAME}`;

    return new EmbedBuilder()
        .setColor(COLORS.alert)
        .setAuthor({
            name: `${guild.name} • Photo Verification`,
            iconURL: guildIcon(guild)
        })
        .setTitle('Reminder — post a selfie')
        .setDescription(
            `You still need to post a selfie in ${channelRef}.\n\n` +
            `Please post one within the next **${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}** to keep your **${PHOTO_VERIFIED_ROLE_NAME}** access.`
        )
        .setTimestamp()
        .setFooter(brandFooter(guild, 'Photo verification'));
}

function buildDmSentStaffEmbed(guild, member, hoursLeft, dmOk) {
    return new EmbedBuilder()
        .setColor(dmOk ? COLORS.alert : COLORS.danger)
        .setAuthor({
            name: 'Photo Verification • DM Escalation',
            iconURL: guildIcon(guild)
        })
        .setTitle(dmOk ? 'DM warning sent' : 'DM warning failed')
        .setDescription(
            dmOk
                ? `Still inactive **24 hours** after the public reminder.`
                : `Still inactive **24 hours** after the public reminder, but their DMs are closed.`
        )
        .addFields(
            {
                name: 'Member',
                value: `<@${member.id}>\n\`${member.user.tag}\``,
                inline: true
            },
            {
                name: 'Next step',
                value: `Auto-revoke in **~${hoursLeft}h** if no selfie`,
                inline: true
            },
            {
                name: 'DM status',
                value: dmOk ? '✅ Delivered' : '❌ Could not deliver',
                inline: true
            }
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .setTimestamp()
        .setFooter(brandFooter(guild, 'Selfie compliance'));
}

function buildRevokeDmEmbed(guild) {
    return new EmbedBuilder()
        .setColor(COLORS.danger)
        .setAuthor({
            name: `${guild.name} • Photo Verification`,
            iconURL: guildIcon(guild)
        })
        .setTitle('Photo verification revoked')
        .setDescription(
            `Your **${PHOTO_VERIFIED_ROLE_NAME}** role was removed due to inactivity in #${SELFIES_CHANNEL_NAME}.\n\n` +
            `If you want it back, open a ticket and send a screenshot of this message.`
        )
        .setTimestamp()
        .setFooter(brandFooter(guild, 'Photo verification'));
}

function buildRevokeStaffEmbed(guild, member, dmOk) {
    return new EmbedBuilder()
        .setColor(COLORS.danger)
        .setAuthor({
            name: 'Photo Verification • Auto-Revoke',
            iconURL: guildIcon(guild)
        })
        .setTitle('Photo Verified removed')
        .setDescription('Grace period ended with no qualifying selfie posted.')
        .addFields(
            {
                name: 'Member',
                value: `<@${member.id}>\n\`${member.user.tag}\``,
                inline: true
            },
            {
                name: 'Grace period',
                value: '48 hours',
                inline: true
            },
            {
                name: 'Revoke DM',
                value: dmOk ? '✅ Delivered' : '❌ Could not deliver',
                inline: true
            }
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .setTimestamp()
        .setFooter(brandFooter(guild, 'Selfie compliance'));
}

async function sendAdminSpamLog(client, guild, content = null, embeds = []) {
    const adminSpamChannel = guild.channels.cache.find(channel => channel.name === ADMIN_SPAM_CHANNEL_NAME);
    if (!adminSpamChannel) {
        console.warn(`[SELFIE COMPLIANCE] #${ADMIN_SPAM_CHANNEL_NAME} not found in ${guild.name}`);
        return;
    }

    const payload = { embeds };
    if (content) payload.content = content;

    await adminSpamChannel.send(payload).catch(error => {
        console.error('[SELFIE COMPLIANCE] Failed to send admins-spam log:', error);
    });
}

async function clearSelfieCompliance(guildId, userId, reason = 'posted_selfie') {
    const result = await SelfieCompliance.updateMany(
        {
            guildId,
            userId,
            status: { $in: ['pending', 'warned'] }
        },
        {
            $set: {
                status: 'cleared',
                clearedAt: new Date(),
                clearReason: reason
            }
        }
    );

    if (result.modifiedCount > 0) {
        console.log(`[SELFIE COMPLIANCE] Cleared ${result.modifiedCount} grace record(s) for user ${userId} (${reason})`);
    }

    return result.modifiedCount;
}

async function scanGuild(client, guild) {
    const role = guild.roles.cache.get(PHOTO_VERIFIED_ROLE_ID);
    if (!role) {
        console.warn(`[SELFIE COMPLIANCE] Photo Verified role not found in ${guild.name}`);
        return;
    }

    const selfiesChannel = guild.channels.cache.find(channel => channel.name === SELFIES_CHANNEL_NAME);
    if (!selfiesChannel) {
        console.warn(`[SELFIE COMPLIANCE] #${SELFIES_CHANNEL_NAME} not found in ${guild.name}`);
        return;
    }

    await guild.members.fetch();

    const thirtyDaysAgo = new Date(Date.now() - INACTIVITY_WINDOW_MS);
    const recentPosts = await SelfiePost.find({
        guildId: guild.id,
        lastPostDate: { $gte: thirtyDaysAgo }
    }).lean();

    const usersWhoPosted = new Set(recentPosts.map(post => post.userId));
    const inactiveMembers = role.members.filter(member => !member.user.bot && !usersWhoPosted.has(member.id));

    if (inactiveMembers.size === 0) {
        await sendAdminSpamLog(client, guild, null, [buildAllClearEmbed(guild)]);
        return;
    }

    const lastPosts = await SelfiePost.find({
        guildId: guild.id,
        userId: { $in: [...inactiveMembers.keys()] }
    }).lean();
    const lastPostByUser = new Map(lastPosts.map(post => [post.userId, post.lastPostDate]));

    const newlyFlagged = [];
    const alreadyInGrace = [];

    for (const member of inactiveMembers.values()) {
        const existing = await SelfieCompliance.findOne({
            guildId: guild.id,
            userId: member.id,
            status: { $in: ['pending', 'warned'] }
        });

        if (existing) {
            alreadyInGrace.push(member);
            continue;
        }

        await SelfieCompliance.create({
            guildId: guild.id,
            userId: member.id,
            username: member.user.tag,
            flaggedAt: new Date(),
            lastPostDateAtFlag: lastPostByUser.get(member.id) || null,
            status: 'pending'
        });
        newlyFlagged.push(member);
    }

    // Public warning in #selfies first (DMs only go out 24h later if still inactive)
    if (newlyFlagged.length > 0) {
        await selfiesChannel.send({ embeds: [buildPublicWarningEmbed(guild, newlyFlagged, selfiesChannel)] }).catch(error => {
            console.error('[SELFIE COMPLIANCE] Failed to send public warning in #selfies:', error);
        });
    }

    await sendAdminSpamLog(client, guild, null, [buildScanReportEmbed(guild, newlyFlagged, alreadyInGrace)]);
    console.log(`[SELFIE COMPLIANCE] Scan in ${guild.name}: flagged ${newlyFlagged.length}, already in grace ${alreadyInGrace.length}`);
}

async function maybeRunScans(client) {
    for (const guild of client.guilds.cache.values()) {
        try {
            let config = await SelfieComplianceConfig.findOne({ guildId: guild.id });
            if (!config) {
                config = await SelfieComplianceConfig.create({ guildId: guild.id, lastScanAt: null });
            }

            const due = !config.lastScanAt || (Date.now() - config.lastScanAt.getTime()) >= SCAN_INTERVAL_MS;
            if (!due) {
                continue;
            }

            console.log(`[SELFIE COMPLIANCE] Running 30-day scan for ${guild.name}`);
            await scanGuild(client, guild);
            config.lastScanAt = new Date();
            await config.save();
        } catch (error) {
            console.error(`[SELFIE COMPLIANCE] Scan failed for guild ${guild.id}:`, error);
        }
    }
}

async function processDueWarnings(client) {
    const cutoff = new Date(Date.now() - DM_DELAY_MS);
    const dueRecords = await SelfieCompliance.find({
        status: 'pending',
        flaggedAt: { $lte: cutoff }
    });

    for (const record of dueRecords) {
        try {
            const guild = client.guilds.cache.get(record.guildId);
            if (!guild) continue;

            const member = await guild.members.fetch(record.userId).catch(() => null);
            if (!member || !member.roles.cache.has(PHOTO_VERIFIED_ROLE_ID)) {
                record.status = 'cleared';
                record.clearedAt = new Date();
                record.clearReason = member ? 'role_removed' : 'member_left';
                await record.save();
                continue;
            }

            // Bail if they posted after being flagged
            const recentPost = await SelfiePost.findOne({
                guildId: record.guildId,
                userId: record.userId,
                lastPostDate: { $gte: record.flaggedAt }
            }).lean();

            if (recentPost) {
                await clearSelfieCompliance(record.guildId, record.userId, 'posted_selfie');
                continue;
            }

            // Still inactive 24h after the public warning — escalate to DM
            const hoursLeft = Math.max(0, Math.ceil((REVOKE_DELAY_MS - DM_DELAY_MS) / (60 * 60 * 1000)));
            const warnEmbed = buildDmWarningEmbed(guild, hoursLeft);

            let dmOk = true;
            try {
                await member.send({ embeds: [warnEmbed] });
            } catch (error) {
                dmOk = false;
                console.warn(`[SELFIE COMPLIANCE] Could not DM ${member.user.tag}:`, error.message);
            }

            record.status = 'warned';
            record.dmSentAt = new Date();
            await record.save();

            await sendAdminSpamLog(client, guild, null, [buildDmSentStaffEmbed(guild, member, hoursLeft, dmOk)]);
        } catch (error) {
            console.error(`[SELFIE COMPLIANCE] Warning failed for ${record.userId}:`, error);
        }
    }
}

async function processDueRevokes(client) {
    const cutoff = new Date(Date.now() - REVOKE_DELAY_MS);
    const dueRecords = await SelfieCompliance.find({
        status: { $in: ['pending', 'warned'] },
        flaggedAt: { $lte: cutoff }
    });

    for (const record of dueRecords) {
        try {
            const guild = client.guilds.cache.get(record.guildId);
            if (!guild) continue;

            const member = await guild.members.fetch(record.userId).catch(() => null);
            if (!member) {
                record.status = 'cleared';
                record.clearedAt = new Date();
                record.clearReason = 'member_left';
                await record.save();
                continue;
            }

            if (!member.roles.cache.has(PHOTO_VERIFIED_ROLE_ID)) {
                record.status = 'cleared';
                record.clearedAt = new Date();
                record.clearReason = 'role_removed';
                await record.save();
                continue;
            }

            const recentPost = await SelfiePost.findOne({
                guildId: record.guildId,
                userId: record.userId,
                lastPostDate: { $gte: record.flaggedAt }
            }).lean();

            if (recentPost) {
                await clearSelfieCompliance(record.guildId, record.userId, 'posted_selfie');
                continue;
            }

            await member.roles.remove(PHOTO_VERIFIED_ROLE_ID);

            let dmOk = true;
            try {
                await member.send({ embeds: [buildRevokeDmEmbed(guild)] });
            } catch (error) {
                dmOk = false;
                console.warn(`[SELFIE COMPLIANCE] Could not DM revoke notice to ${member.user.tag}:`, error.message);
            }

            record.status = 'revoked';
            record.revokedAt = new Date();
            await record.save();

            await sendAdminSpamLog(client, guild, null, [buildRevokeStaffEmbed(guild, member, dmOk)]);
            console.log(`[SELFIE COMPLIANCE] Revoked Photo Verified from ${member.user.tag}`);
        } catch (error) {
            console.error(`[SELFIE COMPLIANCE] Revoke failed for ${record.userId}:`, error);
        }
    }
}

async function runSelfieComplianceTick(client) {
    if (!client?.isReady?.()) {
        return;
    }

    try {
        await maybeRunScans(client);
        await processDueWarnings(client);
        await processDueRevokes(client);
    } catch (error) {
        console.error('[SELFIE COMPLIANCE] Tick failed:', error);
    }
}

function startSelfieComplianceSystem(client) {
    console.log('[SELFIE COMPLIANCE] Starting system (scan every 30 days; public warn → DM at 24h → revoke at 48h; poll every 15m)');

    // Initial tick shortly after ready so startup load settles
    setTimeout(() => runSelfieComplianceTick(client), 30 * 1000);
    setInterval(() => runSelfieComplianceTick(client), POLL_INTERVAL_MS);
}

module.exports = {
    startSelfieComplianceSystem,
    runSelfieComplianceTick,
    clearSelfieCompliance,
    PHOTO_VERIFIED_ROLE_ID,
    SCAN_INTERVAL_MS,
    DM_DELAY_MS,
    REVOKE_DELAY_MS
};
