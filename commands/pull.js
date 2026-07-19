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
        const { queue, error } = await queueManager.resolveQueue(interaction);
        if (error) {
            return queueManager.embedReply(interaction, error, { color: 'error' });
        }

        if (!queueManager.canPull(interaction.member, queue)) {
            const hint = queue.voiceChannelId
                ? `You need to be an admin or in <#${queue.voiceChannelId}> to pull from **${queue.name}**.`
                : `You need to be an admin to pull from **${queue.name}**.`;
            return queueManager.embedReply(interaction, hint, { color: 'error' });
        }

        const count = interaction.options.getInteger('count') || 1;
        const pulled = [];
        for (let i = 0; i < count; i++) {
            const member = await queueManager.pullNext(interaction.client, queue);
            if (!member) break;
            pulled.push(member);
        }

        if (pulled.length === 0) {
            return queueManager.embedReply(interaction, `**${queue.name}** is empty.`);
        }

        return interaction.reply(queueManager.buildPullAnnouncement(queue, pulled.map(m => m.userId)));
    },
};
