const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkuseractivity')
        .setDescription('Checks a user\'s join date and specific roles')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to check')
                .setRequired(true)),
    async execute(interaction) {
        try {
            await interaction.deferReply(); // Acknowledge the interaction immediately

            const targetUser = interaction.options.getUser('target');
            const member = await interaction.guild.members.fetch(targetUser.id);

            // Check for specific roles
            console.log('Checking for specific roles...');
            const greenCircleRole = interaction.guild.roles.cache.find(role => role.name === '🟢');
            const starRole = interaction.guild.roles.cache.find(role => role.name === '⭐');
            const hasGreenCircleRole = greenCircleRole ? member.roles.cache.has(greenCircleRole.id) : false;
            const hasStarRole = starRole ? member.roles.cache.has(starRole.id) : false;
            console.log(`Has Green Circle Role: ${hasGreenCircleRole}`);
            console.log(`Has Star Role: ${hasStarRole}`);

            // Calculate join date
            console.log('Calculating join date...');
            const joinDate = member.joinedAt;
            const now = new Date();
            const diffTime = Math.abs(now - joinDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const diffMonths = Math.floor(diffDays / 30);
            const remainingDays = diffDays % 30;
            console.log(`Join Date: ${diffMonths} months ${remainingDays} days ago`);

            // Create the embed
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${targetUser.username}'s Information`)
                .setDescription(`Here is the information for ${targetUser.username}`)
                .addFields(
                    { name: 'Join Date', value: `${diffMonths} months ${remainingDays} days ago`, inline: true },
                    { name: 'Has Green Circle Role', value: hasGreenCircleRole ? 'Yes' : 'No', inline: true },
                    { name: 'Has Star Role', value: hasStarRole ? 'Yes' : 'No', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'User Information', iconURL: interaction.guild.iconURL() });

            // Send the embed
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error executing checkuseractivity command:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    },
};