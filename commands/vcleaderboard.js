const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const VoiceSession = require('../models/voiceSession');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vcleaderboard')
        .setDescription('View the voice activity leaderboard'),
    
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
                    content: '❌ You must be verified to view the voice leaderboard.', 
                    ephemeral: true 
                });
            }
            
            await interaction.deferReply();
            
            // Aggregate voice sessions by user
            const guildId = interaction.guild.id;
            const results = await VoiceSession.aggregate([
                { $match: { guildId } },
                { 
                    $group: { 
                        _id: '$userId', 
                        totalMs: { $sum: '$durationMs' } 
                    } 
                },
                { $sort: { totalMs: -1 } },
                { $limit: 10 }
            ]);
            
            // Handle no data case
            if (!results || results.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0x9B59B6)
                    .setTitle('🎧 Voice Leaderboard')
                    .setDescription('No voice activity tracked yet.')
                    .setFooter({ 
                        text: 'Voice Activity Tracker', 
                        iconURL: interaction.guild.iconURL() 
                    })
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            // Build leaderboard entries
            const entries = [];
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const userId = result._id;
                const totalMs = result.totalMs;
                
                // Format hours and minutes
                const totalHours = Math.floor(totalMs / (1000 * 60 * 60));
                const totalMinutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
                const timeFormatted = `${totalHours}h ${totalMinutes}m`;
                
                // Try to get member
                let displayName = 'Unknown User';
                try {
                    const member = await interaction.guild.members.fetch(userId);
                    displayName = member.displayName;
                } catch (error) {
                    // User left server or couldn't be fetched
                    displayName = `Unknown User (${userId.slice(0, 8)}...)`;
                }
                
                // Build entry
                const rank = i + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
                entries.push(`${medal} **${displayName}** — ${timeFormatted}`);
            }
            
            // Create embed
            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('🎧 Voice Leaderboard')
                .setDescription(
                    'Top members by valid voice activity (requires 2+ people, excludes AFK channel, anti-mute system enabled).\n\n' +
                    entries.join('\n')
                )
                .setFooter({ 
                    text: 'Last updated', 
                    iconURL: interaction.guild.iconURL() 
                })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('[vcleaderboard] Error:', error);
            
            if (interaction.deferred) {
                return interaction.editReply({ 
                    content: '❌ An error occurred while fetching the leaderboard.', 
                    ephemeral: true 
                });
            } else {
                return interaction.reply({ 
                    content: '❌ An error occurred while fetching the leaderboard.', 
                    ephemeral: true 
                });
            }
        }
    },
};

