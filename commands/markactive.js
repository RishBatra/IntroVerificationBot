const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/user'); // Ensure the path and casing are correct

module.exports = {
    data: new SlashCommandBuilder()
        .setName('markactive')
        .setDescription('Marks a user as active')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to mark as active')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);
        const inactiveRole = interaction.guild.roles.cache.find(role => role.name === 'Inactive ⏸');

        if (!inactiveRole) {
            return interaction.editReply('Inactive role not found.');
        }

        try {
            // Retrieve user data from the database
            const userData = await User.findOne({ userId: user.id });
            if (!userData) {
                return interaction.editReply(`No inactive data found for user ${user.tag}.`);
            }

            // Log the roles to be restored
            console.log(`Restoring roles for ${user.tag}:`, userData.roles);

            // Remove the inactive role and restore the user's roles
            await member.roles.remove(inactiveRole);
            await member.roles.add(userData.roles);

            // Delete the user data from the database
            await User.deleteOne({ userId: user.id });

            // Create an embed message for the success response
            const successEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setDescription(`✅ ${user} has been marked as active and roles restored.`)
                .setTimestamp();

            // Send the embed message as a DM
            try {
                await user.send({ embeds: [successEmbed] });
            } catch (dmError) {
                console.error('Error sending DM to user:', dmError);
            }

            return interaction.editReply({ embeds: [successEmbed] });
        } catch (error) {
            console.error('Error marking user as active:', error);
            return interaction.editReply('There was an error marking the user as active.');
        }
    },
};