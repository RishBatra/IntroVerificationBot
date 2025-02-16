const { ChannelType, PermissionFlagsBits, Collection } = require('discord.js');

class VoiceTextChannelManager {
    constructor(client) {
        this.client = client;
        this.voiceTextChannels = new Collection();
        this.channelCooldowns = new Collection();
        this.excludedChannels = [
            '693018400259047444',
            '693034620618539068',
        ];
        
        // Run cleanup every 6 hours
        setInterval(() => this.cleanupStaleChannels(), 6 * 60 * 60 * 1000);
    }

    async getOrCreateTextChannel(voiceChannel) {
        try {
            if (this.excludedChannels.includes(voiceChannel.id)) {
                return null;
            }

            // Prevent rapid-fire calls
            const cooldown = this.channelCooldowns.get(voiceChannel.id);
            if (cooldown && Date.now() - cooldown < 10000) { // 10-second cooldown
                return this.voiceTextChannels.get(voiceChannel.id);
            }
            this.channelCooldowns.set(voiceChannel.id, Date.now());

            // Check our cache
            let textChannel = this.voiceTextChannels.get(voiceChannel.id);
            if (textChannel) {
                try {
                    await textChannel.fetch();
                    return textChannel;
                } catch {
                    this.voiceTextChannels.delete(voiceChannel.id);
                }
            }

            // Try to find an existing channel by name
            textChannel = voiceChannel.parent?.children.cache.find(
                channel =>
                    channel.type === ChannelType.GuildText &&
                    channel.name === `${voiceChannel.name}-text`
            );
            if (textChannel) {
                this.voiceTextChannels.set(voiceChannel.id, textChannel);
                return textChannel;
            }

            // Create a new text channel
            textChannel = await voiceChannel.guild.channels.create({
                name: `${voiceChannel.name}-text`,
                type: ChannelType.GuildText,
                parent: voiceChannel.parent,
                permissionOverwrites: [
                    {
                        id: voiceChannel.guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: this.client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.ManageMessages
                        ]
                    }
                ],
                reason: `Voice text channel for ${voiceChannel.name}`
            });

            this.voiceTextChannels.set(voiceChannel.id, textChannel);
            return textChannel;
        } catch (error) {
            console.error(`Error in getOrCreateTextChannel: ${error.message}`);
            return null;
        }
    }

    async updateTextChannelVisibility(voiceChannel, member, joined) {
        try {
            if (this.excludedChannels.includes(voiceChannel.id)) return;

            const textChannel = await this.getOrCreateTextChannel(voiceChannel);
            if (!textChannel) return;

            if (joined) {
                // Grant the member permission to view and send messages
                await textChannel.permissionOverwrites.edit(member, {
                    ViewChannel: true,
                    SendMessages: true,
                }).catch(console.error);

                // Send a welcome message (optional)
                await textChannel.send({
                    content: `Welcome ${member}! This channel is linked to ${voiceChannel.name}.`,
                    allowedMentions: { users: [member.id] }
                }).catch(() => {});
            } else {
                // Remove the member's permission override
                await textChannel.permissionOverwrites.delete(member)
                    .catch(console.error);
            }

            // When no members are in the voice channel, purge its messages
            if (voiceChannel.members.size === 0) {
                await this.purgeChannelMessages(textChannel);
            }
        } catch (error) {
            console.error(`Error in updateTextChannelVisibility: ${error.message}`);
        }
    }

    // This method purges all messages in the text channel
    async purgeChannelMessages(textChannel) {
        try {
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const batchSize = 100;
            let totalDeleted = 0;

            while (true) {
                const messages = await textChannel.messages.fetch({ limit: batchSize });
                if (messages.size === 0) break;

                // Bulk-delete messages that are less than 2 weeks old
                const recentMessages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);
                if (recentMessages.size > 0) {
                    await textChannel.bulkDelete(recentMessages, true).catch(console.error);
                    totalDeleted += recentMessages.size;
                }

                // For messages older than 2 weeks, delete one by one
                const oldMessages = messages.filter(msg => msg.createdTimestamp <= twoWeeksAgo);
                for (const [, message] of oldMessages) {
                    await message.delete().catch(() => {});
                    totalDeleted++;
                }

                if (messages.size < batchSize) break;
            }

            console.log(`Purged ${totalDeleted} messages from ${textChannel.name}`);
        } catch (error) {
            console.error(`Error in purgeChannelMessages: ${error.message}`);
        }
    }

    async cleanupStaleChannels() {
        try {
            // For each cached text channel, if the corresponding voice channel is empty (or missing), purge its messages.
            for (const [voiceId, textChannel] of this.voiceTextChannels) {
                const voiceChannel = this.client.channels.cache.get(voiceId);
                if (!voiceChannel || voiceChannel.members.size === 0) {
                    await this.purgeChannelMessages(textChannel);
                    // Optionally, leave the text channel in the cache so it can be reused later.
                    // If you prefer to force a new channel creation next time, uncomment the following line:
                    // this.voiceTextChannels.delete(voiceId);
                }
            }
        } catch (error) {
            console.error(`Error in cleanupStaleChannels: ${error.message}`);
        }
    }
}

module.exports = VoiceTextChannelManager;