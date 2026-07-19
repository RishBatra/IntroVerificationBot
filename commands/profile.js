const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const VoiceSession = require('../models/voiceSession');
const { getUserProfile, getMemberRanking } = require('../utils/tatsuClient');
const { buildProfileCard } = require('../utils/profileCard');

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
                return interaction.editReply({
                    content:
                        '❌ Could not fetch Tatsu data. Check the API key and that the key owner is in this server.',
                });
            }

            const [vcHours, vcStreak] = await Promise.all([
                getVoiceHours(guildId, userId),
                getVCStreak(guildId, userId),
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

            const buffer = await buildProfileCard({
                avatarUrl,
                username: displayName,
                title: tatsuProfile.title || tatsuProfile.info_box || 'No title set',
                rank: ranking?.rank ?? null,
                score: ranking?.score ?? 0,
                reputation: tatsuProfile.reputation ?? 0,
                vcHours,
                vcStreak,
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
