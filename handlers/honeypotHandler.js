const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Honeypot = require('../models/honeypot');

/**
 * Handles messages posted in honeypot channels
 * Immediately bans users who post in the honeypot
 */
async function handleHoneypot(message) {
    try {
        // Don't ban bots or users with administrator permissions
        if (message.author.bot) return false;
        
        const member = message.member;
        if (!member) return false;

        // Don't ban administrators or moderators
        if (member.permissions.has(PermissionFlagsBits.Administrator) || 
            member.permissions.has(PermissionFlagsBits.BanMembers)) {
            await message.reply('⚠️ As a moderator, you won\'t be banned, but regular users who post here will be immediately banned!');
            return true;
        }

        // Check if this channel is a honeypot
        const honeypot = await Honeypot.findOne({
            guildId: message.guild.id,
            channelId: message.channel.id,
            enabled: true
        });

        if (!honeypot) return false;

        // Log the user before banning
        console.log(`🍯 HONEYPOT TRIGGERED: ${message.author.tag} (${message.author.id}) posted in honeypot channel`);
        console.log(`Message content: ${message.content}`);

        // Store ban information
        honeypot.bannedUsers.push({
            userId: message.author.id,
            username: message.author.tag,
            bannedAt: new Date(),
            messageContent: message.content.substring(0, 500) // Limit content length
        });
        await honeypot.save();

        // Try to DM the user before banning (optional)
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('🚫 You Have Been Banned')
                .setDescription(`You have been automatically banned from **${message.guild.name}** for posting in the honeypot channel.`)
                .addFields(
                    { name: '📋 Reason', value: 'Posted in #do-not-post honeypot channel' },
                    { name: '⚠️ Warning', value: 'This channel was clearly marked as a trap for compromised accounts. You were warned not to post there.' }
                )
                .setColor('#FF0000')
                .setTimestamp();
            
            await message.author.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.log('Could not DM user before ban:', error.message);
        }

        // Delete all messages from the user in the honeypot channel
        try {
            const messages = await message.channel.messages.fetch({ limit: 100 });
            const userMessages = messages.filter(m => m.author.id === message.author.id);
            
            for (const msg of userMessages.values()) {
                try {
                    await msg.delete();
                } catch (err) {
                    console.error('Error deleting message:', err);
                }
            }
        } catch (error) {
            console.error('Error fetching/deleting messages:', error);
        }

        // Ban the user
        try {
            await member.ban({
                reason: '🍯 Posted in honeypot channel (#do-not-post) - Likely compromised account',
                deleteMessageSeconds: 60 * 60 * 24 * 7 // Delete messages from last 7 days
            });

            console.log(`✅ Successfully banned ${message.author.tag} for posting in honeypot`);

            // Log to a mod channel if it exists
            await logHoneypotBan(message.guild, message.author, message.content);

            return true;
        } catch (error) {
            console.error('Error banning user from honeypot:', error);
            
            // Try to notify mods if ban fails
            const modChannel = message.guild.channels.cache.find(
                ch => ch.name === 'mod-logs' || ch.name === 'audit-log' || ch.name === 'logs'
            );
            
            if (modChannel) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Honeypot Ban Failed')
                    .setDescription(`Failed to ban ${message.author.tag} for posting in honeypot`)
                    .addFields(
                        { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                        { name: 'Error', value: error.message }
                    )
                    .setColor('#FFA500')
                    .setTimestamp();
                
                await modChannel.send({ embeds: [errorEmbed] });
            }
        }

    } catch (error) {
        console.error('Error in handleHoneypot:', error);
    }

    return false;
}

/**
 * Logs honeypot bans to a mod channel
 */
async function logHoneypotBan(guild, user, messageContent) {
    try {
        // Try to find a logging channel
        const logChannel = guild.channels.cache.find(
            ch => ch.name === 'mod-logs' || 
                  ch.name === 'audit-log' || 
                  ch.name === 'logs' ||
                  ch.name === 'bot-logs'
        );

        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('🍯 Honeypot Ban')
                .setDescription(`**${user.tag}** was automatically banned for posting in the honeypot channel`)
                .addFields(
                    { name: '👤 User', value: `${user.tag}\n\`${user.id}\``, inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '📝 Message Content', value: messageContent.substring(0, 1000) || 'No content' }
                )
                .setThumbnail(user.displayAvatarURL())
                .setColor('#FF0000')
                .setTimestamp()
                .setFooter({ text: 'Honeypot Security System' });

            await logChannel.send({ embeds: [logEmbed] });
        }
    } catch (error) {
        console.error('Error logging honeypot ban:', error);
    }
}

module.exports = {
    handleHoneypot,
    logHoneypotBan
};

