const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // Check if the message is from the #intros channel
        const introsChannelId = 'YOUR_INTROS_CHANNEL_ID';
        const logChannelId = 'YOUR_LOG_CHANNEL_ID';

        console.log(`Message deleted in channel ID: ${message.channel.id}`);

        if (message.channel.id === introsChannelId) {
            console.log('Message is from the intros channel.');

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
                    type: AuditLogEvent.MessageDelete,
                });

                const deletionLog = fetchedLogs.entries.first();
                console.log('Fetched audit logs:', deletionLog);

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
                .setColor(0xff0000)
                .setTitle('Message Deleted')
                .setThumbnail(message.author.displayAvatarURL())
                .addFields(
                    { name: 'Author', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Channel', value: `${message.channel.name}`, inline: true },
                    { name: 'Deleted by', value: deleter, inline: true },
                    { name: 'Content', value: message.content || 'No content' }
                )
                .setFooter({ text: `Message ID: ${message.id}` })
                .setTimestamp();

            logChannel.send({ embeds: [embed] });
            console.log('Logged deleted message.');
        } else {
            console.log('Message is not from the intros channel.');
        }
    },
};
