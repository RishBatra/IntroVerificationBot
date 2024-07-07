const { Events, EmbedBuilder, GuildAuditLogs } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // Check if the message is from the #intros channel
        const introsChannelId = '692965776545546261';
        const logChannelId = '1259323620661133342';

        if (message.channel.id === introsChannelId) {
            const logChannel = message.guild.channels.cache.get(logChannelId);

            if (!logChannel) {
                console.error(`Log channel with ID ${logChannelId} not found`);
                return;
            }

            let deleter = 'Unknown';

            try {
                // Fetch audit logs to find the deleter
                const fetchedLogs = await message.guild.fetchAuditLogs({
                    limit: 1,
                    type: GuildAuditLogs.Actions.MESSAGE_DELETE,
                });

                const deletionLog = fetchedLogs.entries.first();

                if (deletionLog) {
                    const { executor, target } = deletionLog;
                    if (target.id === message.author.id) {
                        deleter = executor.tag;
                    }
                }
            } catch (error) {
                console.error('Error fetching audit logs:', error);
            }

            const embed = new EmbedBuilder()
                .setTitle('Message Deleted')
                .setColor(0xff0000)
                .addFields(
                    { name: 'Author', value: `${message.author.tag} (${message.author.id})` },
                    { name: 'Channel', value: `${message.channel.name} (${message.channel.id})` },
                    { name: 'Content', value: message.content || 'No content' },
                    { name: 'Deleted by', value: deleter }
                )
                .setTimestamp();

            logChannel.send({ embeds: [embed] });
        }
    },
};
