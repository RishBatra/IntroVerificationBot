const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { clearSelfieCompliance } = require('../handlers/selfieComplianceHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revoke-photo-verification')
        .setDescription('Revokes photo verification from one or multiple users')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Single user to revoke photo verification from')
                .setRequired(false))
        .addStringOption(option =>
            option
                .setName('users')
                .setDescription('Multiple user IDs separated by spaces or commas')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        try {
            // Defer reply immediately to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            const singleUser = interaction.options.getUser('user');
            const usersString = interaction.options.getString('users');
            const roleId = '907912045817634846';

            // Validate that at least one option is provided
            if (!singleUser && !usersString) {
                return await interaction.editReply({
                    content: 'Please provide either a user or a list of user IDs.'
                });
            }

            // Validate that only one option is provided
            if (singleUser && usersString) {
                return await interaction.editReply({
                    content: 'Please provide either a single user OR multiple user IDs, not both.'
                });
            }

            // Collect user IDs to process
            let userIds = [];
            if (singleUser) {
                userIds = [singleUser.id];
            } else {
                // Parse multiple user IDs (split by spaces or commas)
                userIds = usersString.split(/[\s,]+/).filter(id => id.trim());
            }

            // Process each user
            const results = {
                success: [],
                noRole: [],
                dmFailed: [],
                errors: []
            };

            for (const userId of userIds) {
                try {
                    // Fetch user and member
                    const user = await interaction.client.users.fetch(userId);
                    const member = await interaction.guild.members.fetch(userId);

                    // Check if user has the role
                    if (!member.roles.cache.has(roleId)) {
                        results.noRole.push(user.tag);
                        continue;
                    }

                    // Remove the role
                    await member.roles.remove(roleId);
                    await clearSelfieCompliance(interaction.guild.id, userId, 'manual_revoke');

                    // Send DM to user
                    try {
                        await user.send({
                            content: 'Your photo verification was revoked due to inactivity. If you wish to get it again, open a ticket and send a screenshot of this message.'
                        });
                        results.success.push(user.tag);
                    } catch (error) {
                        results.dmFailed.push(user.tag);
                    }
                } catch (error) {
                    console.error(`Error processing user ${userId}:`, error);
                    results.errors.push(userId);
                }
            }

            // Build response message
            let response = '**Photo Verification Revocation Results:**\n\n';

            if (results.success.length > 0) {
                response += `✅ **Successfully revoked (${results.success.length}):**\n${results.success.join(', ')}\n\n`;
            }

            if (results.dmFailed.length > 0) {
                response += `⚠️ **Role removed but DM failed (${results.dmFailed.length}):**\n${results.dmFailed.join(', ')}\n\n`;
            }

            if (results.noRole.length > 0) {
                response += `ℹ️ **No photo verification role (${results.noRole.length}):**\n${results.noRole.join(', ')}\n\n`;
            }

            if (results.errors.length > 0) {
                response += `❌ **Errors (${results.errors.length}):**\nUser IDs: ${results.errors.join(', ')}\n\n`;
            }

            // If no users were processed
            if (userIds.length === 0) {
                response = 'No valid user IDs provided.';
            }

            await interaction.editReply({ content: response });

        } catch (error) {
            console.error(error);
            const replyMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
            await interaction[replyMethod]({
                content: 'There was an error while executing this command.',
                ephemeral: true
            });
        }
    },
};
