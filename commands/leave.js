const { SlashCommandBuilder } = require('discord.js');
const queueManager = require('../utils/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Leave a queue')
        .addStringOption(opt => opt.setName('queue').setDescription('Queue name (optional if only one exists)').setAutocomplete(true)),

    async autocomplete(interaction) {
        await queueManager.queueNameAutocomplete(interaction);
    },

    async execute(interaction) {
        if (!queueManager.isVerifiedMember(interaction.member)) {
            return interaction.reply({ content: queueManager.NOT_VERIFIED_MESSAGE, ephemeral: true });
        }

        const { queue, error } = await queueManager.resolveQueue(interaction);
        if (error) {
            return interaction.reply({ content: error, ephemeral: true });
        }

        const result = await queueManager.leaveQueue(interaction.client, queue, interaction.user.id);
        return interaction.reply({ content: result.message, ephemeral: true });
    },
};
