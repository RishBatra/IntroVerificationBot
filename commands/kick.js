const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kicks a member from the server.')
        .addUserOption(option => option.setName('target').setDescription('The member to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for kicking').setRequired(false)),
    async execute(interaction) {
        if (!interaction.member.permissions.has('KICK_MEMBERS')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target.kickable) {
            return interaction.reply({ content: 'I cannot kick this user. Do they have a higher role? Do I have kick permissions?', ephemeral: true });
        }

        await target.kick(reason)
            .then(() => interaction.reply({ content: `${target.user.tag} has been kicked for: ${reason}`, ephemeral: true }))
            .catch(error => {
                console.error(error);
                interaction.reply({ content: 'There was an error trying to kick this user.', ephemeral: true });
            });
    },
};