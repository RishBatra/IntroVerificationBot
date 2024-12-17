const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pgban')
        .setDescription('Ban unverified users and log the action')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(true)),

    execute: async function(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const target = interaction.options.getMember('target');
            const reason = interaction.options.getString('reason');
            const logChannel = interaction.guild.channels.cache.get('1313354922074570782');

            // Role checks
            const waitingRole = interaction.guild.roles.cache.get('692985716040532011');
            const verifiedRole = interaction.guild.roles.cache.get('692985789608362005');
            const modRole = interaction.guild.roles.cache.get('800053595881078784');

            // Validation checks
            if (!target) {
                return await interaction.editReply('User not found in the server.');
            }

            // Check for mod role
            if (!interaction.member.roles.cache.has(modRole.id)) {
                return await interaction.editReply('You do not have permission to use this command.');
            }

            if (!target.roles.cache.has(waitingRole.id) || target.roles.cache.has(verifiedRole.id)) {
                return await interaction.editReply('This user is either verified or not in waiting status.');
            }

            // Ban the user
            await target.ban({ reason: reason });

            // Create and send log embed
            const logEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('User Banned')
                .addFields(
                    { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
                    { name: 'Banned By', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
            await interaction.editReply(`Successfully banned ${target.user.tag} and logged the action.`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('An error occurred while executing the command.');
        }
    }
};
