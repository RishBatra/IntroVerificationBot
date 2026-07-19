const Queue = require('../models/queue');
const queueManager = require('../utils/queueManager');

// Handles buttons with customId: queue_join:<id>, queue_leave:<id>, queue_pull:<id>
async function handleQueueButton(interaction) {
    const [action, queueId] = interaction.customId.split(':');
    const queue = await Queue.findById(queueId);

    if (!queue) {
        return queueManager.embedReply(interaction, 'This queue no longer exists.', { color: 'error' });
    }

    if (action === 'queue_join' || action === 'queue_leave') {
        if (!queueManager.isVerifiedMember(interaction.member)) {
            return queueManager.embedReply(interaction, queueManager.NOT_VERIFIED_MESSAGE, { color: 'error' });
        }

        const result = action === 'queue_join'
            ? await queueManager.joinQueue(interaction.client, queue, interaction.user.id)
            : await queueManager.leaveQueue(interaction.client, queue, interaction.user.id);
        return queueManager.embedReply(interaction, result.message, { color: result.ok ? 'success' : 'error' });
    }

    if (action === 'queue_pull') {
        if (!queueManager.canPull(interaction.member, queue)) {
            const hint = queue.voiceChannelId
                ? `You need to be an admin or in <#${queue.voiceChannelId}> to pull from **${queue.name}**.`
                : `You need to be an admin to pull from **${queue.name}**.`;
            return queueManager.embedReply(interaction, hint, { color: 'error' });
        }

        const member = await queueManager.pullNext(interaction.client, queue);
        if (!member) {
            return queueManager.embedReply(interaction, `**${queue.name}** is empty.`);
        }

        return interaction.reply(queueManager.buildPullAnnouncement(queue, [member.userId]));
    }
}

module.exports = { handleQueueButton };
