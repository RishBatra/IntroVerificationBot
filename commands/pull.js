const { SlashCommandBuilder } = require('discord.js');
const queueManager = require('../utils/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pull')
        .setDescription('Pull the next member(s) from a queue (admin only)')
        .addStringOption(opt => opt.setName('queue').setDescription('Queue name (optional if only one exists)').setAutocomplete(true))
        .addIntegerOption(opt => opt.setName('count').setDescription('How many to pull (default 1)').setMinValue(1).setMaxValue(10)),

    async autocomplete(interaction) {
        await queueManager.queueNameAutocomplete(interaction);
    },

    async execute(interaction) {
        if (!queueManager.isQueueAdmin(interaction.member)) {
            return interaction.reply({ content: 'You need to be an admin to pull from queues.', ephemeral: true });
        }

        const { queue, error } = await queueManager.resolveQueue(interaction);
        if (error) {
            return interaction.reply({ content: error, ephemeral: true });
        }

        const count = interaction.options.getInteger('count') || 1;
        const pulled = [];
        for (let i = 0; i < count; i++) {
            const member = await queueManager.pullNext(interaction.client, queue);
            if (!member) break;
            pulled.push(member);
        }

        if (pulled.length === 0) {
            return interaction.reply({ content: `**${queue.name}** is empty.`, ephemeral: true });
        }

        const announcements = pulled.map(m => queueManager.formatPullAnnouncement(queue, m.userId));
        return interaction.reply({ content: announcements.join('\n') });
    },
};
