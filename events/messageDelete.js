const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // Check if the message is from the #intros channel
        const introsChannelId = '692965776545546261';
        const logChannelId = '1259323620661133342';

        console.log(`Message deleted in channel ID: ${message.channel.id}`);

        if (message.channel.id === introsChannelId) {
            console.log('Message is from the intros channel.');

            const logChannel = message.guild.channels.cache.get(logChannelId);

            if (!logChannel) {
                console.error(`Log channel with ID ${logChannelId} not found`);
                return;
            }

            let deleter = 'Unknown';
            let isAuthorDeleted = false;

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
                    if (target && message.author && target.id === message.author.id) {
                        deleter = executor ? executor.tag : 'Unknown';
                        // Check if the author deleted their own message
                        isAuthorDeleted = executor && executor.id === message.author.id;
                    }
                }
            } catch (error) {
                console.error('Error fetching audit logs:', error);
            }

            if (!message.author) {
                console.log('Message author is null, skipping log creation');
                return;
            }

            // Handle role changes if user deleted their own intro and has verified role
            let shouldTagAdmins = false;
            const verifiedRole = message.guild.roles.cache.find(role => role.name === 'Verified');
            const waitingForVerificationRole = message.guild.roles.cache.find(role => role.name === 'Waiting for Verification');
            const member = message.guild.members.cache.get(message.author.id);

            if (isAuthorDeleted && member && verifiedRole && waitingForVerificationRole) {
                // Check if user has the verified role
                if (member.roles.cache.has(verifiedRole.id)) {
                    console.log(`User ${message.author.tag} deleted their intro and has verified role. Removing roles...`);
                    shouldTagAdmins = true;

                    try {
                        // Get all user roles except @everyone
                        const rolesToRemove = member.roles.cache.filter(role => role.id !== message.guild.id);
                        
                        // Remove all roles
                        await member.roles.remove(rolesToRemove);
                        console.log(`Removed all roles from ${message.author.tag}`);

                        // Add waiting for verification role back
                        await member.roles.add(waitingForVerificationRole);
                        console.log(`Added Waiting for Verification role to ${message.author.tag}`);

                        // Send DM to the user
                        try {
                            const dmEmbed = new EmbedBuilder()
                                .setColor(0xff6b6b)
                                .setTitle('⚠️ Verification Status Changed')
                                .setDescription('You have deleted your intro message from the server.')
                                .addFields(
                                    { name: '❌ Roles Removed', value: 'All your roles have been removed, including your **Verified** role.' },
                                    { name: '🔄 Current Status', value: 'You now have the **Waiting for Verification** role.' },
                                    { name: '📝 Next Steps', value: 'Please post a new intro in the #intros channel to get verified again.' }
                                )
                                .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() })
                                .setTimestamp();

                            await message.author.send({ embeds: [dmEmbed] });
                            console.log(`Sent DM to ${message.author.tag} about verification status change`);
                        } catch (dmError) {
                            console.error(`Failed to send DM to ${message.author.tag}:`, dmError);
                            // User might have DMs disabled, but continue with the process
                        }
                    } catch (error) {
                        console.error('Error managing roles:', error);
                    }
                }
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

            // Tag admins if verified user deleted their intro
            const adminsRole = message.guild.roles.cache.find(role => role.name === 'Admins');
            const messageContent = shouldTagAdmins && adminsRole 
                ? { content: `<@&${adminsRole.id}> A verified user deleted their intro!`, embeds: [embed] }
                : { embeds: [embed] };

            logChannel.send(messageContent);
            console.log('Logged deleted message.');
        } else {
            console.log('Message is not from the intros channel.');
        }
    },
};
