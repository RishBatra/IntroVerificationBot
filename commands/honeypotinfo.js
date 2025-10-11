const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Honeypot = require('../models/honeypot');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('honeypotinfo')
        .setDescription('View honeypot channel information and banned users')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const honeypot = await Honeypot.findOne({ guildId: interaction.guild.id });

            if (!honeypot) {
                return await interaction.editReply('❌ No honeypot channel configured for this server. Use `/setuphoneypot` to create one.');
            }

            const channel = interaction.guild.channels.cache.get(honeypot.channelId);
            const channelMention = channel ? `<#${channel.id}>` : `Unknown (${honeypot.channelId})`;

            const embed = new EmbedBuilder()
                .setTitle('🍯 Honeypot Channel Information')
                .addFields(
                    { name: '📢 Channel', value: channelMention, inline: true },
                    { name: '⚡ Status', value: honeypot.enabled ? '✅ Active' : '❌ Disabled', inline: true },
                    { name: '📊 Total Bans', value: honeypot.bannedUsers.length.toString(), inline: true }
                )
                .setColor(honeypot.enabled ? '#00FF00' : '#FF0000')
                .setTimestamp();

            // Show recent bans
            if (honeypot.bannedUsers.length > 0) {
                const recentBans = honeypot.bannedUsers
                    .sort((a, b) => b.bannedAt - a.bannedAt)
                    .slice(0, 10)
                    .map((ban, index) => {
                        const date = new Date(ban.bannedAt);
                        const timestamp = `<t:${Math.floor(date.getTime() / 1000)}:R>`;
                        return `${index + 1}. **${ban.username}** (\`${ban.userId}\`) - ${timestamp}`;
                    })
                    .join('\n');

                embed.addFields({ name: '🚫 Recent Bans', value: recentBans });
            } else {
                embed.addFields({ name: '🚫 Recent Bans', value: 'No bans yet' });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error getting honeypot info:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    },
};

