const { SlashCommandBuilder } = require('discord.js');
const Queue = require('../models/queue');
const queueManager = require('../utils/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('positions')
        .setDescription('See your position in every queue'),

    async execute(interaction) {
        if (!queueManager.isVerifiedMember(interaction.member)) {
            return interaction.reply({ content: queueManager.NOT_VERIFIED_MESSAGE, ephemeral: true });
        }

        const queues = await Queue.find({ guildId: interaction.guild.id });
        if (queues.length === 0) {
            return interaction.reply({ content: 'No queues exist yet.', ephemeral: true });
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
            return interaction.reply({ content: "You're not in any queues.", ephemeral: true });
        }

        return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    },
};
