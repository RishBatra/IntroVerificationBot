const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Honeypot = require('../models/honeypot');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('togglehoneypot')
        .setDescription('Enable or disable the honeypot channel')
        .addBooleanOption(option =>
            option.setName('enabled')
                .setDescription('Enable or disable the honeypot')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const enabled = interaction.options.getBoolean('enabled');
            
            const honeypot = await Honeypot.findOne({ guildId: interaction.guild.id });

            if (!honeypot) {
                return await interaction.editReply('❌ No honeypot configured. Use `/setuphoneypot` first.');
            }

            honeypot.enabled = enabled;
            await honeypot.save();

            const embed = new EmbedBuilder()
                .setTitle(`🍯 Honeypot ${enabled ? 'Enabled' : 'Disabled'}`)
                .setDescription(`The honeypot channel <#${honeypot.channelId}> is now **${enabled ? 'active' : 'inactive'}**.`)
                .setColor(enabled ? '#00FF00' : '#FF0000')
                .setTimestamp();

            if (enabled) {
                embed.addFields({ 
                    name: '⚠️ Warning', 
                    value: 'Users who post in the honeypot channel will be immediately banned.' 
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error toggling honeypot:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    },
};

