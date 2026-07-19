const { SlashCommandBuilder } = require('discord.js');
const Queue = require('../models/queue');
const queueManager = require('../utils/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('show')
        .setDescription('View the current queue lineup (only you will see it)')
        .addStringOption(opt => opt.setName('queue').setDescription('Queue name (optional: shows all queues if omitted)').setAutocomplete(true)),

    async autocomplete(interaction) {
        await queueManager.queueNameAutocomplete(interaction);
    },

    async execute(interaction) {
        if (!queueManager.isVerifiedMember(interaction.member)) {
            return queueManager.embedReply(interaction, queueManager.NOT_VERIFIED_MESSAGE, { color: 'error' });
        }

        const name = interaction.options.getString('queue');
        let queues;
        if (name) {
            const queue = await queueManager.findQueue(interaction.guild.id, name);
            if (!queue) {
                return queueManager.embedReply(interaction, `No queue named **${name}** found.`, { color: 'error' });
            }
            queues = [queue];
        } else {
            queues = await Queue.find({ guildId: interaction.guild.id });
            if (queues.length === 0) {
                return queueManager.embedReply(interaction, 'No queues exist yet.');
            }
        }

        // Snapshot only (no buttons): embeds are capped at 10 per message
        const embeds = [];
        for (const queue of queues.slice(0, 10)) {
            const display = await queueManager.buildDisplay(queue);
            embeds.push(...display.embeds);
        }

        return interaction.reply({ embeds, ephemeral: true });
    },
};
