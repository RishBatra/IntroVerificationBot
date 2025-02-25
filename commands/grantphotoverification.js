const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grant-photo-verification')
        .setDescription('Grants photo verification to a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to grant photo verification to')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const member = await interaction.guild.members.fetch(targetUser.id);
            const roleId = '907912045817634846';

            // Check if user already has the role
            if (member.roles.cache.has(roleId)) {
                return await interaction.reply({
                    content: 'This user already has photo verification.',
                    ephemeral: true
                });
            }

            // Add the role
            await member.roles.add(roleId);

            // Send DM to user
            try {
                await targetUser.send({
                    content: `You have been granted photo verification. You now have access to selfies channel in the server.\nYou can check out <#770372403779207190> to post your first selfie! We're excited to see you join our channel! 📸`
                });
            } catch (error) {
                await interaction.reply({
                    content: `Role added but couldn't send DM to ${targetUser.tag}. They might have DMs disabled.`,
                    ephemeral: true
                });
                return;
            }

            // Confirm to staff member
            await interaction.reply({
                content: `Successfully granted photo verification to ${targetUser.tag} and sent them a DM.`,
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
