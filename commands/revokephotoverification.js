const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revoke-photo-verification')
        .setDescription('Revokes photo verification from a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to revoke photo verification from')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const member = await interaction.guild.members.fetch(targetUser.id);
            const roleId = '907912045817634846';

            // Check if user has the role
            if (!member.roles.cache.has(roleId)) {
                return await interaction.reply({
                    content: 'This user does not have photo verification.',
                    ephemeral: true
                });
            }

            // Remove the role
            await member.roles.remove(roleId);

            // Send DM to user
            try {
                await targetUser.send({
                    content: 'Your photo verification was revoked due to inactivity. If you wish to get it again, open a ticket and send a screenshot of this message.'
                });
            } catch (error) {
                await interaction.reply({
                    content: `Role removed but couldn't send DM to ${targetUser.tag}. They might have DMs disabled.`,
                    ephemeral: true
                });
                return;
            }

            // Confirm to staff member
            await interaction.reply({
                content: `Successfully revoked photo verification from ${targetUser.tag} and sent them a DM.`,
                ephemeral: true
            });

        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: 'There was an error while executing this command.',
                ephemeral: true
            });
        }
    },
};
