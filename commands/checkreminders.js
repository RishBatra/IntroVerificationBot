const { SlashCommandBuilder } = require('discord.js');
const { checkForReminders, handleExistingIntros } = require('../handlers/introManagementHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkreminders')
        .setDescription('Manually check for intro reminders (for testing)'),
    async execute(interaction) {
        // Check if user has admin permissions
        const adminRole = interaction.guild.roles.cache.find(role => role.name === 'Admins');
        const proudGuardiansRole = interaction.guild.roles.cache.find(role => role.name === 'Proud Guardians');
        
        if (!interaction.member.roles.cache.has(adminRole?.id) && !interaction.member.roles.cache.has(proudGuardiansRole?.id)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            console.log(`[MANUAL CHECK] Manual reminder check triggered by ${interaction.user.tag}`);
            
            // First handle existing intros
            await handleExistingIntros();
            
            // Then check for reminders
            await checkForReminders();
            
            await interaction.editReply({ content: '✅ Manual reminder check completed! Check the console logs for details.' });
            
        } catch (error) {
            console.error('[MANUAL CHECK] Error during manual check:', error);
            await interaction.editReply({ content: '❌ Error during manual reminder check. Check console logs.' });
        }
    },
}; 