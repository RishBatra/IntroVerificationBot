const { SlashCommandBuilder } = require('discord.js');
const Queue = require('../models/queue');
const queueManager = require('../utils/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('positions')
        .setDescription('See your position in every queue'),

    async execute(interaction) {
        if (!queueManager.isVerifiedMember(interaction.member)) {
            return queueManager.embedReply(interaction, queueManager.NOT_VERIFIED_MESSAGE, { color: 'error' });
        }

        const queues = await Queue.find({ guildId: interaction.guild.id });
        if (queues.length === 0) {
            return queueManager.embedReply(interaction, 'No queues exist yet.');
        }

        const lines = [];
        for (const queue of queues) {
            const members = await queueManager.getSortedMembers(queue._id);
            const index = members.findIndex(m => m.userId === interaction.user.id);
            if (index !== -1) {
                lines.push(`**${queue.name}** — position **#${index + 1}** of ${members.length}`);
            }
        }

        if (lines.length === 0) {
            return queueManager.embedReply(interaction, "You're not in any queues.");
        }

        return queueManager.embedReply(interaction, lines.join('\n'), { title: '📍 Your positions' });
    },
};
