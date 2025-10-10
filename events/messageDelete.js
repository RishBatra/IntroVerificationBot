const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        console.log('[MESSAGE DELETE EVENT] Event triggered!');
        
        try {
            // Fetch partial message if needed
            if (message.partial) {
                console.log('[MESSAGE DELETE] Message is partial, attempting to fetch...');
                try {
                    await message.fetch();
                    console.log('[MESSAGE DELETE] Message fetched successfully');
                } catch (error) {
                    console.error('[MESSAGE DELETE] Error fetching partial message:', error);
                    // Continue anyway, we'll work with what we have
                }
            }
        } catch (error) {
            console.error('[MESSAGE DELETE] Error handling partial message:', error);
        }

        // Check if the message is from the #intros channel
        const introsChannelId = '692965776545546261';
        const logChannelId = '1259323620661133342';

        console.log(`[MESSAGE DELETE] Message deleted in channel ID: ${message.channel.id}`);
        console.log(`[MESSAGE DELETE] Initial message author:`, message.author ? message.author.tag : 'Unknown (will check audit logs)');
        console.log(`[MESSAGE DELETE] Message content:`, message.content || 'No content');

        if (message.channel.id === introsChannelId) {
            console.log('[MESSAGE DELETE] Message is from the intros channel.');

            const logChannel = message.guild.channels.cache.get(logChannelId);

            if (!logChannel) {
                console.error(`[MESSAGE DELETE] Log channel with ID ${logChannelId} not found`);
                return;
            }

            // Check bot permissions
            const botMember = message.guild.members.me;
            if (botMember) {
                const hasAuditLogPerms = botMember.permissions.has('ViewAuditLog');
                console.log(`[MESSAGE DELETE] Bot has VIEW_AUDIT_LOG permission: ${hasAuditLogPerms}`);
            }

            let deleter = 'Unknown';
            let isAuthorDeleted = false;
            let messageAuthor = message.author; // Store the author, might update from audit logs

            try {
                // Fetch audit logs to find the deleter
                const fetchedLogs = await message.guild.fetchAuditLogs({
                    limit: 5, // Fetch more entries to find the right one
                    type: AuditLogEvent.MessageDelete,
                });

                console.log(`[MESSAGE DELETE] Total audit log entries fetched: ${fetchedLogs.entries.size}`);
                
                // Find the audit log entry that matches our deletion (within last 5 seconds)
                let deletionLog = fetchedLogs.entries.find(entry => {
                    const timeDiff = Date.now() - entry.createdTimestamp;
                    console.log(`[MESSAGE DELETE] Checking entry - Time diff: ${timeDiff}ms, Executor: ${entry.executor?.tag}, Target: ${entry.target?.tag}`);
                    return timeDiff < 5000; // Within 5 seconds
                });
                
                if (deletionLog) {
                    console.log('[MESSAGE DELETE] Found recent audit log entry');
                    const { executor, target } = deletionLog;
                    
                    // If message author is null, try to get it from audit logs
                    if (!messageAuthor && target) {
                        messageAuthor = target;
                        console.log(`[MESSAGE DELETE] Got message author from audit logs: ${target.tag}`);
                    }
                    
                    if (target && messageAuthor && target.id === messageAuthor.id) {
                        deleter = executor ? executor.tag : 'Unknown';
                        // Check if the author deleted their own message
                        isAuthorDeleted = executor && executor.id === messageAuthor.id;
                        console.log(`[MESSAGE DELETE] Deleter: ${deleter}, isAuthorDeleted: ${isAuthorDeleted}`);
                    }
                } else {
                    console.log('[MESSAGE DELETE] No recent audit log found');
                    // If no recent audit log and message author exists, assume self-deletion
                    // (Discord doesn't create audit logs for users deleting their own messages)
                    if (messageAuthor) {
                        console.log('[MESSAGE DELETE] Assuming user deleted their own message (no audit log for self-deletions)');
                        deleter = messageAuthor.tag;
                        isAuthorDeleted = true;
                    }
                }
            } catch (error) {
                console.error('[MESSAGE DELETE] Error fetching audit logs:', error);
            }

            if (!messageAuthor) {
                console.log('[MESSAGE DELETE] Message author is null and could not be determined from audit logs, skipping log creation');
                return;
            }

            // Handle role changes if user deleted their own intro and has verified role
            let shouldTagAdmins = false;
            const verifiedRole = message.guild.roles.cache.find(role => role.name === 'Verified');
            const waitingForVerificationRole = message.guild.roles.cache.find(role => role.name === 'Waiting for Verification');
            const member = message.guild.members.cache.get(messageAuthor.id);

            if (isAuthorDeleted && member && verifiedRole && waitingForVerificationRole) {
                // Check if user has the verified role
                if (member.roles.cache.has(verifiedRole.id)) {
                    console.log(`[MESSAGE DELETE] User ${messageAuthor.tag} deleted their intro and has verified role. Removing roles...`);
                    shouldTagAdmins = true;

                    try {
                        // Get all user roles except @everyone
                        const rolesToRemove = member.roles.cache.filter(role => role.id !== message.guild.id);
                        
                        // Remove all roles
                        await member.roles.remove(rolesToRemove);
                        console.log(`[MESSAGE DELETE] Removed all roles from ${messageAuthor.tag}`);

                        // Add waiting for verification role back
                        await member.roles.add(waitingForVerificationRole);
                        console.log(`[MESSAGE DELETE] Added Waiting for Verification role to ${messageAuthor.tag}`);

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

                            await messageAuthor.send({ embeds: [dmEmbed] });
                            console.log(`[MESSAGE DELETE] Sent DM to ${messageAuthor.tag} about verification status change`);
                        } catch (dmError) {
                            console.error(`[MESSAGE DELETE] Failed to send DM to ${messageAuthor.tag}:`, dmError);
                            
                            // If DM fails, tag user in verification-help channel
                            const verificationHelpChannelId = '1242333346131087420';
                            const verificationHelpChannel = message.guild.channels.cache.get(verificationHelpChannelId);
                            
                            if (verificationHelpChannel) {
                                try {
                                    const fallbackEmbed = new EmbedBuilder()
                                        .setColor(0xff6b6b)
                                        .setTitle('⚠️ Verification Status Changed')
                                        .setDescription(`<@${messageAuthor.id}>, you have deleted your intro message from the server.`)
                                        .addFields(
                                            { name: '❌ Roles Removed', value: 'All your roles have been removed, including your **Verified** role.' },
                                            { name: '🔄 Current Status', value: 'You now have the **Waiting for Verification** role.' },
                                            { name: '📝 Next Steps', value: 'Please post a new intro in <#692965776545546261> to get verified again.' }
                                        )
                                        .setTimestamp();

                                    await verificationHelpChannel.send({ 
                                        content: `<@${messageAuthor.id}>`, 
                                        embeds: [fallbackEmbed] 
                                    });
                                    console.log(`[MESSAGE DELETE] Sent notification to verification-help channel for ${messageAuthor.tag}`);
                                } catch (channelError) {
                                    console.error(`[MESSAGE DELETE] Failed to send message to verification-help channel:`, channelError);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('[MESSAGE DELETE] Error managing roles:', error);
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Message Deleted')
                .setThumbnail(messageAuthor.displayAvatarURL())
                .addFields(
                    { name: 'Author', value: `<@${messageAuthor.id}>`, inline: true },
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

            await logChannel.send(messageContent);
            console.log('[MESSAGE DELETE] Logged deleted message successfully.');
        } else {
            console.log('[MESSAGE DELETE] Message is not from the intros channel.');
        }
    },
};
