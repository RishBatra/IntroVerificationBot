const { SlashCommandBuilder } = require('discord.js');
const Queue = require('../models/queue');
const QueueMember = require('../models/queueMember');
const queueManager = require('../utils/queueManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queues')
        .setDescription('Manage queues (admin only)')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Create a new queue')
                .addStringOption(opt => opt.setName('name').setDescription('Queue name').setRequired(true))
                .addBooleanOption(opt => opt.setName('rotation').setDescription('Karaoke rotation: pulled members rejoin at the back (default: true)'))
                .addIntegerOption(opt => opt.setName('size').setDescription('Max queue size').setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a queue')
                .addStringOption(opt => opt.setName('name').setDescription('Queue name').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all queues'))
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Change queue settings')
                .addStringOption(opt => opt.setName('name').setDescription('Queue name').setRequired(true).setAutocomplete(true))
                .addBooleanOption(opt => opt.setName('rotation').setDescription('Karaoke rotation on/off'))
                .addBooleanOption(opt => opt.setName('locked').setDescription('Lock/unlock joining'))
                .addIntegerOption(opt => opt.setName('size').setDescription('Max queue size (0 = unlimited)').setMinValue(0))
                .addStringOption(opt => opt.setName('pull_message').setDescription('Announcement when someone is pulled. Use {user} for the mention.'))),

    async autocomplete(interaction) {
        await queueManager.queueNameAutocomplete(interaction);
    },

    async execute(interaction) {
        if (!queueManager.isQueueAdmin(interaction.member)) {
            return interaction.reply({ content: 'You need to be an admin to manage queues.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'add') {
            const name = interaction.options.getString('name').trim();
            const rotation = interaction.options.getBoolean('rotation') ?? true;
            const size = interaction.options.getInteger('size');

            const existing = await Queue.findOne({ guildId, name });
            if (existing) {
                return interaction.reply({ content: `A queue named **${name}** already exists.`, ephemeral: true });
            }

            await Queue.create({
                guildId,
                name,
                rotation,
                size: size || null,
                createdBy: interaction.user.id,
            });

            return interaction.reply({
                content: `Queue **${name}** created${rotation ? ' with karaoke rotation on' : ''}. Use \`/show queue:${name}\` in a channel to post the live display.`,
                ephemeral: true,
            });
        }

        if (sub === 'delete') {
            const name = interaction.options.getString('name');
            const queue = await Queue.findOne({ guildId, name });
            if (!queue) {
                return interaction.reply({ content: `No queue named **${name}** found.`, ephemeral: true });
            }

            // Remove the live display message if it exists
            if (queue.displayChannelId && queue.displayMessageId) {
                try {
                    const channel = await interaction.client.channels.fetch(queue.displayChannelId);
                    const message = await channel.messages.fetch(queue.displayMessageId);
                    await message.delete();
                } catch {
                    // Display already gone
                }
            }

            await QueueMember.deleteMany({ queueId: queue._id });
            await Queue.deleteOne({ _id: queue._id });

            return interaction.reply({ content: `Queue **${name}** deleted.`, ephemeral: true });
        }

        if (sub === 'list') {
            const queues = await Queue.find({ guildId });
            if (queues.length === 0) {
                return interaction.reply({ content: 'No queues exist yet. Create one with `/queues add`.', ephemeral: true });
            }

            const counts = await QueueMember.aggregate([
                { $match: { guildId } },
                { $group: { _id: '$queueId', count: { $sum: 1 } } },
            ]);
            const countMap = new Map(counts.map(c => [String(c._id), c.count]));

            const lines = queues.map(q => {
                const parts = [`**${q.name}** — ${countMap.get(String(q._id)) || 0} member(s)`];
                if (q.rotation) parts.push('rotation');
                if (q.size) parts.push(`max ${q.size}`);
                if (q.locked) parts.push('🔒 locked');
                return parts.join(' • ');
            });

            return interaction.reply({ content: lines.join('\n'), ephemeral: true });
        }

        if (sub === 'set') {
            const name = interaction.options.getString('name');
            const queue = await Queue.findOne({ guildId, name });
            if (!queue) {
                return interaction.reply({ content: `No queue named **${name}** found.`, ephemeral: true });
            }

            const rotation = interaction.options.getBoolean('rotation');
            const locked = interaction.options.getBoolean('locked');
            const size = interaction.options.getInteger('size');
            const pullMessage = interaction.options.getString('pull_message');

            const changes = [];
            if (rotation !== null) { queue.rotation = rotation; changes.push(`rotation ${rotation ? 'on' : 'off'}`); }
            if (locked !== null) { queue.locked = locked; changes.push(locked ? 'locked' : 'unlocked'); }
            if (size !== null) { queue.size = size === 0 ? null : size; changes.push(size === 0 ? 'size unlimited' : `size ${size}`); }
            if (pullMessage !== null) { queue.pullMessage = pullMessage; changes.push('pull message updated'); }

            if (changes.length === 0) {
                return interaction.reply({ content: 'Nothing to change — pass at least one setting.', ephemeral: true });
            }

            await queue.save();
            queueManager.scheduleDisplayRefresh(interaction.client, queue._id);

            return interaction.reply({ content: `Queue **${name}** updated: ${changes.join(', ')}.`, ephemeral: true });
        }
    },
};
