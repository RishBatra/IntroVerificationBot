const { SlashCommandBuilder } = require('discord.js');
const queueManager = require('../utils/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join a queue')
        .addStringOption(opt => opt.setName('queue').setDescription('Queue name (optional if only one exists)').setAutocomplete(true)),

    async autocomplete(interaction) {
        await queueManager.queueNameAutocomplete(interaction);
    },

    async execute(interaction) {
        if (!queueManager.isVerifiedMember(interaction.member)) {
            return queueManager.embedReply(interaction, queueManager.NOT_VERIFIED_MESSAGE, { color: 'error' });
        }

        const { queue, error } = await queueManager.resolveQueue(interaction);
        if (error) {
            return queueManager.embedReply(interaction, error, { color: 'error' });
        }

        const result = await queueManager.joinQueue(interaction.client, queue, interaction.user.id);
        return queueManager.embedReply(interaction, result.message, { color: result.ok ? 'success' : 'error' });
    },
};
