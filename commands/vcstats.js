const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const VoiceSession = require('../models/voiceSession');

// Role requirements
const GREEN_ROLE_HOURS = 10;
const STAR_ROLE_HOURS = 30;

/**
 * Calculate total voice hours for a user
 * @param {string} guildId 
 * @param {string} userId 
 * @returns {Promise<number>} Total hours
 */
async function getVoiceHours(guildId, userId) {
    try {
        const result = await VoiceSession.aggregate([
            { $match: { guildId, userId } },
            { $group: { _id: null, totalMs: { $sum: '$durationMs' } } }
        ]);
        
        if (!result || result.length === 0) return 0;
        
        const totalMs = result[0].totalMs || 0;
        const hours = totalMs / (1000 * 60 * 60);
        return hours;
    } catch (error) {
        console.error('[vcstats] Error fetching voice hours:', error);
        return 0;
    }
}

/**
 * Calculate VC streak (consecutive days with activity)
 * @param {string} guildId 
 * @param {string} userId 
 * @returns {Promise<number>} Streak in days
 */
async function getVCStreak(guildId, userId) {
    try {
        // Get all sessions for the user
        const sessions = await VoiceSession.find({ guildId, userId })
            .sort({ joinedAt: -1 })
            .lean();
        
        if (!sessions || sessions.length === 0) return 0;
        
        // Get unique days with activity (using joinedAt date)
        const activeDays = new Set();
        for (const session of sessions) {
            const day = new Date(session.joinedAt);
            day.setHours(0, 0, 0, 0);
            activeDays.add(day.getTime());
        }
        
        if (activeDays.size === 0) return 0;
        
        // Sort days in descending order (most recent first)
        const sortedDays = Array.from(activeDays).sort((a, b) => b - a);
        
        // Calculate streak from most recent day backwards
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();
        const msPerDay = 24 * 60 * 60 * 1000;
        
        // Start from the most recent active day
        const mostRecentDay = sortedDays[0];
        
        // Determine the starting day for streak calculation
        // If today has activity, start from today; otherwise start from yesterday if it has activity
        const daysSinceLastActivity = Math.floor((todayTime - mostRecentDay) / msPerDay);
        
        // If most recent activity was more than 1 day ago, streak is broken
        if (daysSinceLastActivity > 1) return 0;
        
        // Determine starting day: today if it has activity, otherwise yesterday
        let startDay;
        if (daysSinceLastActivity === 0) {
            // Activity today
            startDay = todayTime;
        } else {
            // Activity yesterday (daysSinceLastActivity === 1)
            startDay = mostRecentDay;
        }
        
        // Calculate consecutive days starting from startDay going backwards
        let streak = 0;
        let currentDay = startDay;
        
        for (const dayTime of sortedDays) {
            // Check if this day matches the current expected day
            if (dayTime === currentDay) {
                streak++;
                // Move to previous day
                currentDay -= msPerDay;
            } else if (dayTime < currentDay) {
                // Gap found, streak is broken
                break;
            }
            // Skip if dayTime > currentDay (shouldn't happen with sorted array, but safe)
        }
        
        return streak;
    } catch (error) {
        console.error('[vcstats] Error calculating streak:', error);
        return 0;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vcstats')
        .setDescription('View your voice chat activity statistics')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('View stats for another user (optional)')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        try {
            // Check if user has Verified role
            const verifiedRole = interaction.guild.roles.cache.find(role => role.name === 'Verified');
            
            if (!verifiedRole) {
                return interaction.reply({ 
                    content: '❌ Verified role not found in this server.', 
                    ephemeral: true 
                });
            }
            
            if (!interaction.member.roles.cache.has(verifiedRole.id)) {
                return interaction.reply({ 
                    content: '❌ You must be verified to use this command.', 
                    ephemeral: true 
                });
            }
            
            await interaction.deferReply();
            
            // Get target user (default to command user)
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const guildId = interaction.guild.id;
            const userId = targetUser.id;
            const isSelf = targetUser.id === interaction.user.id;
            
            // Get voice hours and streak
            const totalHours = await getVoiceHours(guildId, userId);
            const streak = await getVCStreak(guildId, userId);
            
            // Build embed
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setAuthor({ 
                    name: `${targetUser.displayName}'s VC Stats`, 
                    iconURL: targetUser.displayAvatarURL() 
                })
                .setThumbnail(targetUser.displayAvatarURL());
            
            // If no activity exists
            if (totalHours === 0) {
                embed.setDescription('No VC activity recorded yet.')
                    .addFields({
                        name: '📊 Total VC Hours',
                        value: '0 hours',
                        inline: false
                    })
                    .setFooter({ text: 'VC tracking is experimental' });
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            // Format hours with one decimal place
            const formattedHours = totalHours.toFixed(1);
            
            // Use appropriate pronouns based on whether viewing self or other
            const pronoun = isSelf ? 'You' : 'They';
            
            // Build fields
            embed.addFields(
                {
                    name: '⏱️ Total VC Hours',
                    value: `${pronoun} ${isSelf ? 'have' : 'has'} been active in VC for **${formattedHours} hours**.`,
                    inline: false
                },
                {
                    name: '🔥 VC Streak',
                    value: streak > 0 
                        ? `${pronoun} ${isSelf ? 'are' : 'is'} on a **${streak}-day streak**.`
                        : `${pronoun} ${isSelf ? 'don\'t' : 'doesn\'t'} have a streak yet.`,
                    inline: false
                }
            );
            
            // Progress toward roles
            const greenProgress = Math.min(totalHours, GREEN_ROLE_HOURS);
            const starProgress = Math.min(totalHours, STAR_ROLE_HOURS);
            
            const greenCompleted = totalHours >= GREEN_ROLE_HOURS;
            const starCompleted = totalHours >= STAR_ROLE_HOURS;
            
            embed.addFields(
                {
                    name: '🟢 Green Role Progress',
                    value: greenCompleted
                        ? `✅ **Completed** (${formattedHours} / ${GREEN_ROLE_HOURS} hours)`
                        : `**${greenProgress.toFixed(1)}** / ${GREEN_ROLE_HOURS} hours`,
                    inline: true
                },
                {
                    name: '⭐ Star Role Progress',
                    value: starCompleted
                        ? `✅ **Completed** (${formattedHours} / ${STAR_ROLE_HOURS} hours)`
                        : `**${starProgress.toFixed(1)}** / ${STAR_ROLE_HOURS} hours`,
                    inline: true
                }
            );
            
            embed.setFooter({ text: 'VC tracking is experimental' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('[vcstats] Error:', error);
            
            if (interaction.deferred) {
                return interaction.editReply({ 
                    content: '❌ An error occurred while fetching VC stats.', 
                    ephemeral: true 
                });
            } else {
                return interaction.reply({ 
                    content: '❌ An error occurred while fetching VC stats.', 
                    ephemeral: true 
                });
            }
        }
    },
};

