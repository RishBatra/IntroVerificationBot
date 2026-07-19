const Queue = require('../models/queue');
const queueManager = require('../utils/queueManager');

// Handles buttons with customId: queue_join:<id>, queue_leave:<id>, queue_pull:<id>
async function handleQueueButton(interaction) {
    const [action, queueId] = interaction.customId.split(':');
    const queue = await Queue.findById(queueId);

    if (!queue) {
        return interaction.reply({ content: 'This queue no longer exists.', ephemeral: true });
    }

    if (action === 'queue_join' || action === 'queue_leave') {
        if (!queueManager.isVerifiedMember(interaction.member)) {
            return interaction.reply({ content: queueManager.NOT_VERIFIED_MESSAGE, ephemeral: true });
        }

        const result = action === 'queue_join'
            ? await queueManager.joinQueue(interaction.client, queue, interaction.user.id)
            : await queueManager.leaveQueue(interaction.client, queue, interaction.user.id);
        return interaction.reply({ content: result.message, ephemeral: true });
    }

    if (action === 'queue_pull') {
        if (!queueManager.isQueueAdmin(interaction.member)) {
            return interaction.reply({ content: 'Only admins can pull from the queue.', ephemeral: true });
        }

        const member = await queueManager.pullNext(interaction.client, queue);
        if (!member) {
            return interaction.reply({ content: `**${queue.name}** is empty.`, ephemeral: true });
        }

        return interaction.reply({ content: queueManager.formatPullAnnouncement(queue, member.userId) });
    }
}

module.exports = { handleQueueButton };
