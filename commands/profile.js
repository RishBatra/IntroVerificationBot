const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const VoiceSession = require('../models/voiceSession');
const CardPreference = require('../models/cardPreference');
const { getUserProfile, getMemberRanking, getGuildRankings } = require('../utils/tatsuClient');
const { buildProfileCard } = require('../utils/profileCard');

// Pronoun role IDs from this server (see audit.js) — array preserves display order
const SPECIFIC_PRONOUN_ROLE_IDS = [
    '692960596844478465', // He/Him
    '692960617614540801', // She/Her
    '692960634786152468', // They/Them
];
const ASK_PRONOUN_ROLE_ID = '886563278191464478'; // Ask for Pronouns

async function getVoiceHours(guildId, userId) {
    try {
        const result = await VoiceSession.aggregate([
            { $match: { guildId, userId } },
            { $group: { _id: null, totalMs: { $sum: '$durationMs' } } },
        ]);
        if (!result?.length) return 0;
        return (result[0].totalMs || 0) / (1000 * 60 * 60);
    } catch (error) {
        console.error('[profile] Error fetching voice hours:', error);
        return 0;
    }
}

async function getVCStreak(guildId, userId) {
    try {
        const sessions = await VoiceSession.find({ guildId, userId })
            .sort({ joinedAt: -1 })
            .lean();

        if (!sessions?.length) return 0;

        const activeDays = new Set();
        for (const session of sessions) {
            const day = new Date(session.joinedAt);
            day.setHours(0, 0, 0, 0);
            activeDays.add(day.getTime());
        }

        const sortedDays = Array.from(activeDays).sort((a, b) => b - a);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysSinceLastActivity = Math.floor((todayTime - sortedDays[0]) / msPerDay);
        if (daysSinceLastActivity > 1) return 0;

        let currentDay = daysSinceLastActivity === 0 ? todayTime : sortedDays[0];
        let streak = 0;
        for (const dayTime of sortedDays) {
            if (dayTime === currentDay) {
                streak++;
                currentDay -= msPerDay;
            } else if (dayTime < currentDay) {
                break;
            }
        }
        return streak;
    } catch (error) {
        console.error('[profile] Error calculating streak:', error);
        return 0;
    }
}

/**
 * Specific pronoun roles win over Ask. No role -> null (subtitle falls back to title).
 * One role -> shown as written (e.g. "He/Him"). Multiple roles -> first segments
 * merged in role order (e.g. He/Him + They/Them -> "He/They").
 */
function getPronounDisplay(member) {
    if (!member?.roles?.cache) return null;

    const specificRoles = SPECIFIC_PRONOUN_ROLE_IDS
        .map(id => member.roles.cache.get(id))
        .filter(Boolean);

    if (specificRoles.length === 1) return specificRoles[0].name;
    if (specificRoles.length > 1) {
        return specificRoles.map(role => role.name.split('/')[0]).join('/');
    }

    if (member.roles.cache.has(ASK_PRONOUN_ROLE_ID)) return 'ask';

    return null;
}

/**
 * Points needed to reach the score of the member currently one rank above.
 * Rank #1 has no next target.
 */
async function getProgressToNextRank(guildId, ranking) {
    if (!ranking?.rank || ranking.rank <= 1) {
        return { pointsRemaining: null, nextRank: null };
    }

    const nextRank = ranking.rank - 1;
    // Rankings are 0-indexed via offset; person at rank N is at offset N-1
    const offset = Math.max(0, nextRank - 1);

    try {
        const page = await getGuildRankings(guildId, 'all', offset);
        const above = page?.rankings?.find(entry => Number(entry.rank) === nextRank)
            || page?.rankings?.[0];

        if (!above || above.score == null) {
            return { pointsRemaining: null, nextRank };
        }

        const gap = Number(above.score) - Number(ranking.score || 0);
        // Need at least 1 pt to pull ahead when tied or somehow ahead of snapshot
        const pointsRemaining = gap > 0 ? gap : 1;
        return { pointsRemaining, nextRank };
    } catch (error) {
        console.error('[profile] Error fetching next-rank progress:', error);
        return { pointsRemaining: null, nextRank };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View a fancy profile card with Tatsu + voice stats')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to view (defaults to you)')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            // Prefer the known Verified role ID; fall back to name match
            const VERIFIED_ROLE_ID = '692985789608362005';
            const executor =
                interaction.member ??
                (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

            if (!executor) {
                return interaction.reply({
                    content: '❌ Could not resolve your member profile.',
                    ephemeral: true,
                });
            }

            const verifiedRole =
                interaction.guild.roles.cache.get(VERIFIED_ROLE_ID) ||
                interaction.guild.roles.cache.find(role => role.name === 'Verified');

            if (!verifiedRole) {
                return interaction.reply({
                    content: '❌ Verified role not found in this server.',
                    ephemeral: true,
                });
            }

            if (!executor.roles.cache.has(verifiedRole.id)) {
                return interaction.reply({
                    content: '❌ You must be verified to use this command.',
                    ephemeral: true,
                });
            }

            if (!process.env.TATSU_API_KEY) {
                return interaction.reply({
                    content: '❌ `TATSU_API_KEY` is not configured on the bot.',
                    ephemeral: true,
                });
            }

            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member =
                interaction.options.getMember('user') ||
                (targetUser.id === executor.id
                    ? executor
                    : await interaction.guild.members.fetch(targetUser.id).catch(() => null));

            const guildId = interaction.guild.id;
            const userId = targetUser.id;

            let tatsuProfile = null;
            let ranking = null;

            try {
                [tatsuProfile, ranking] = await Promise.all([
                    getUserProfile(userId),
                    getMemberRanking(guildId, userId, 'all').catch(err => {
                        if (err.status === 404) return null;
                        throw err;
                    }),
                ]);
            } catch (error) {
                console.error('[profile] Tatsu API error:', error);
                if (error.status === 401) {
                    return interaction.editReply({
                        content:
                            '❌ Tatsu rejected the API key (401). Set a valid `TATSU_API_KEY` on the host — create one with `t!apikey create`, paste it with no quotes, then restart the bot.',
                    });
                }
                return interaction.editReply({
                    content:
                        '❌ Could not fetch Tatsu data. Check the API key and that the key owner is in this server.',
                });
            }

            const [vcHours, vcStreak, progress, cardPreference] = await Promise.all([
                getVoiceHours(guildId, userId),
                getVCStreak(guildId, userId),
                getProgressToNextRank(guildId, ranking),
                CardPreference.findOne({ guildId, userId }).lean().catch(() => null),
            ]);

            const displayName =
                member?.displayName ||
                targetUser.globalName ||
                tatsuProfile.username ||
                targetUser.username;

            const avatarUrl = (
                member?.displayAvatarURL({ extension: 'png', size: 256 }) ||
                targetUser.displayAvatarURL({ extension: 'png', size: 256 }) ||
                tatsuProfile.avatar_url
            );

            const title = (tatsuProfile.title || '').trim();

            const buffer = await buildProfileCard({
                avatarUrl,
                username: displayName,
                pronounDisplay: getPronounDisplay(member),
                title,
                rank: ranking?.rank ?? null,
                pointsRemaining: progress.pointsRemaining,
                nextRank: progress.nextRank,
                score: ranking?.score ?? 0,
                vcHours,
                vcStreak,
                joinedAt: member?.joinedAt ?? null,
                flagKey: cardPreference?.flag ?? null,
            });

            const attachment = new AttachmentBuilder(buffer, {
                name: `profile-${userId}.png`,
            });

            await interaction.editReply({ files: [attachment] });
        } catch (error) {
            console.error('[profile] Error:', error);

            if (interaction.deferred) {
                return interaction.editReply({
                    content: '❌ An error occurred while generating the profile card.',
                });
            }

            return interaction.reply({
                content: '❌ An error occurred while generating the profile card.',
                ephemeral: true,
            });
        }
    },
};
