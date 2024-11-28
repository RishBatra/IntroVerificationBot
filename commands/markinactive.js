const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/user'); // Adjust the path as necessary

module.exports = {
    data: new SlashCommandBuilder()
        .setName('markinactive')
        .setDescription('Mark a user as inactive')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to mark as inactive')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply(); // Defer the reply to avoid interaction expiry

        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);
        const inactiveRole = interaction.guild.roles.cache.find(role => role.name === 'Inactive ⏸');

        if (!inactiveRole) {
            return interaction.editReply('Inactive role not found.'); // Use editReply to send the response
        }

        try {
            // Save current roles to the database
            const userRoles = member.roles.cache.filter(role => role.id !== inactiveRole.id).map(role => role.id);
            await User.findOneAndUpdate(
                { userId: user.id },
                { userId: user.id, roles: userRoles },
                { upsert: true }
            );

            // Remove all roles except the inactive role
            await member.roles.remove(userRoles);
            await member.roles.add(inactiveRole);

            // Create an embed message for the user
            const userEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('You have been marked as inactive')
                .setDescription('You have been marked as inactive. Raise a talk to mods request if you want to be active again.')
                .setTimestamp();

            // Send the embed message as a DM
            await user.send({ embeds: [userEmbed] });

            // Create an embed message for the success response
            const successEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setDescription(`✅ ${user} has been marked as inactive.`)
                .setTimestamp();

            // Reply to the command interaction with the success embed
            return interaction.editReply({ embeds: [successEmbed] }); // Use editReply to send the response
        } catch (error) {
            console.error('Error marking user as inactive:', error);
            return interaction.editReply('There was an error marking the user as inactive.'); // Use editReply to send the response
        }
    },
};