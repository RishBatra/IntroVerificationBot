const { SlashCommandBuilder } = require('discord.js');
const queueManager = require('../utils/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('displays')
        .setDescription('Post the live auto-updating queue display in this channel (admin only)')
        .addStringOption(opt => opt.setName('queue').setDescription('Queue name (optional if only one exists)').setAutocomplete(true)),

    async autocomplete(interaction) {
        await queueManager.queueNameAutocomplete(interaction);
    },

    async execute(interaction) {
        if (!queueManager.isQueueAdmin(interaction.member)) {
            return queueManager.embedReply(interaction, 'You need to be an admin to post queue displays.', { color: 'error' });
        }

        const { queue, error } = await queueManager.resolveQueue(interaction);
        if (error) {
            return queueManager.embedReply(interaction, error, { color: 'error' });
        }

        await interaction.deferReply({ ephemeral: true });
        await queueManager.postDisplay(queue, interaction.channel);
        return interaction.editReply({
            embeds: [queueManager.makeEmbed(`Live display for **${queue.name}** posted. It updates automatically as people join and leave.`, { color: 'success' })],
        });
    },
};
