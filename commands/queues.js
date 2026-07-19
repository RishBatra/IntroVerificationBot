const { SlashCommandBuilder, ChannelType } = require('discord.js');
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
                .addIntegerOption(opt => opt.setName('size').setDescription('Max queue size').setMinValue(1))
                .addChannelOption(opt => opt.setName('voice_channel').setDescription('Voice channel whose members can pull').addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)))
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
                .addStringOption(opt => opt.setName('pull_message').setDescription('Announcement when someone is pulled. Use {user} for the mention.'))
                .addChannelOption(opt => opt.setName('voice_channel').setDescription('Voice channel whose members can pull').addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice))),

    async autocomplete(interaction) {
        await queueManager.queueNameAutocomplete(interaction);
    },

    async execute(interaction) {
        if (!queueManager.isQueueAdmin(interaction.member)) {
            return queueManager.embedReply(interaction, 'You need to be an admin to manage queues.', { color: 'error' });
        }

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'add') {
            const name = interaction.options.getString('name').trim();
            const rotation = interaction.options.getBoolean('rotation') ?? true;
            const size = interaction.options.getInteger('size');
            const voiceChannel = interaction.options.getChannel('voice_channel');

            const existing = await Queue.findOne({ guildId, name });
            if (existing) {
                return queueManager.embedReply(interaction, `A queue named **${name}** already exists.`, { color: 'error' });
            }

            await Queue.create({
                guildId,
                name,
                rotation,
                size: size || null,
                voiceChannelId: voiceChannel?.id || null,
                createdBy: interaction.user.id,
            });

            const details = [
                `Queue **${name}** created${rotation ? ' with karaoke rotation on' : ''}.`,
                voiceChannel ? `Members in ${voiceChannel} can pull the next singer.` : null,
                `Use \`/show queue:${name}\` in a channel to post the live display.`,
            ].filter(Boolean).join('\n');

            return queueManager.embedReply(interaction, details, { color: 'success', title: '✅ Queue created' });
        }

        if (sub === 'delete') {
            const name = interaction.options.getString('name');
            const queue = await Queue.findOne({ guildId, name });
            if (!queue) {
                return queueManager.embedReply(interaction, `No queue named **${name}** found.`, { color: 'error' });
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

            return queueManager.embedReply(interaction, `Queue **${name}** deleted.`, { color: 'success' });
        }

        if (sub === 'list') {
            const queues = await Queue.find({ guildId });
            if (queues.length === 0) {
                return queueManager.embedReply(interaction, 'No queues exist yet. Create one with `/queues add`.');
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
                if (q.voiceChannelId) parts.push(`🔊 <#${q.voiceChannelId}>`);
                if (q.locked) parts.push('🔒 locked');
                return parts.join(' • ');
            });

            return queueManager.embedReply(interaction, lines.join('\n'), { title: '📋 Queues' });
        }

        if (sub === 'set') {
            const name = interaction.options.getString('name');
            const queue = await Queue.findOne({ guildId, name });
            if (!queue) {
                return queueManager.embedReply(interaction, `No queue named **${name}** found.`, { color: 'error' });
            }

            const rotation = interaction.options.getBoolean('rotation');
            const locked = interaction.options.getBoolean('locked');
            const size = interaction.options.getInteger('size');
            const pullMessage = interaction.options.getString('pull_message');
            const voiceChannel = interaction.options.getChannel('voice_channel');

            const changes = [];
            if (rotation !== null) { queue.rotation = rotation; changes.push(`rotation ${rotation ? 'on' : 'off'}`); }
            if (locked !== null) { queue.locked = locked; changes.push(locked ? 'locked' : 'unlocked'); }
            if (size !== null) { queue.size = size === 0 ? null : size; changes.push(size === 0 ? 'size unlimited' : `size ${size}`); }
            if (pullMessage !== null) { queue.pullMessage = pullMessage; changes.push('pull message updated'); }
            if (voiceChannel !== null) { queue.voiceChannelId = voiceChannel.id; changes.push(`voice channel ${voiceChannel}`); }

            if (changes.length === 0) {
                return queueManager.embedReply(interaction, 'Nothing to change — pass at least one setting.', { color: 'error' });
            }

            await queue.save();
            queueManager.scheduleDisplayRefresh(interaction.client, queue._id);

            return queueManager.embedReply(interaction, `Queue **${name}** updated: ${changes.join(', ')}.`, { color: 'success' });
        }
    },
};
