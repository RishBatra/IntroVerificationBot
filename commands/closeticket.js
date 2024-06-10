const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close a support ticket')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for closing the ticket')
                .setRequired(false)),
    async execute(interaction) {
        const modMailCategory = interaction.guild.channels.cache.find(c => c.name === 'Talk to Mods' && c.type === 'GUILD_CATEGORY');
        if (interaction.channel.parentId !== modMailCategory.id) {
            return interaction.reply({ content: 'This command can only be used in a ModMail ticket channel.', ephemeral: true });
        }

        const reason = interaction.options.getString('reason') || 'No reason provided';
        const logsChannel = interaction.guild.channels.cache.find(c => c.name === 'mod-logs' && c.type === 'GUILD_TEXT');
        if (!logsChannel) {
            return interaction.reply({ content: 'Logs channel does not exist. Please create one named "mod-logs".', ephemeral: true });
        }

        await logsChannel.send(`Ticket closed by ${interaction.user.tag} for reason: ${reason}`);
        await interaction.channel.delete();
    },
};