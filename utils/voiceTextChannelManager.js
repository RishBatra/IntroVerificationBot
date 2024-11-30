const { ChannelType, PermissionFlagsBits, Collection } = require('discord.js');

class VoiceTextChannelManager {
    constructor(client) {
        this.client = client;
        this.voiceTextChannels = new Collection();
        this.channelCooldowns = new Collection();
        this.channelLocks = new Set(); // Lock set for preventing duplicates
        this.excludedChannels = [
            '693018400259047444',
            '693034620618539068',
        ];

        // Cleanup interval for stale channels (every 6 hours)
        setInterval(() => this.cleanupStaleChannels(), 6 * 60 * 60 * 1000);
    }

    async getOrCreateTextChannel(voiceChannel) {
        if (this.excludedChannels.includes(voiceChannel.id)) {
            return null;
        }

        if (this.channelLocks.has(voiceChannel.id)) {
            // Wait for the lock to be released
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                    if (!this.channelLocks.has(voiceChannel.id)) {
                        clearInterval(interval);
                        resolve(this.voiceTextChannels.get(voiceChannel.id) || null);
                    }
                }, 100);
            });
        }

        // Lock the channel ID
        this.channelLocks.add(voiceChannel.id);

        try {
            // Check cooldown to prevent spam
            const cooldown = this.channelCooldowns.get(voiceChannel.id);
            if (cooldown && Date.now() - cooldown < 10000) { // 10 seconds cooldown
                return this.voiceTextChannels.get(voiceChannel.id);
            }

            // Update cooldown
            this.channelCooldowns.set(voiceChannel.id, Date.now());

            // Check cache first
            let textChannel = this.voiceTextChannels.get(voiceChannel.id);
            if (textChannel) {
                try {
                    await textChannel.fetch();
                    return textChannel;
                } catch {
                    this.voiceTextChannels.delete(voiceChannel.id);
                }
            }

            // Fetch the latest parent state and look for an existing channel
            await voiceChannel.parent?.children.fetch();
            textChannel = voiceChannel.parent?.children.cache.find(
                channel =>
                    channel.type === ChannelType.GuildText &&
                    channel.name === `${voiceChannel.name}-text`
            );

            if (textChannel) {
                this.voiceTextChannels.set(voiceChannel.id, textChannel);
                return textChannel;
            }

            // Create a new channel
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
        } finally {
            // Release the lock
            this.channelLocks.delete(voiceChannel.id);
        }
    }

    async updateTextChannelVisibility(voiceChannel, member, joined) {
        try {
            if (this.excludedChannels.includes(voiceChannel.id)) return;

            const textChannel = await this.getOrCreateTextChannel(voiceChannel);
            if (!textChannel) return;

            if (joined) {
                await textChannel.permissionOverwrites.edit(member, {
                    ViewChannel: true,
                    SendMessages: true,
                }).catch(console.error);

                // Send welcome message
                await textChannel.send({
                    content: `Welcome ${member}! This channel is linked to ${voiceChannel.name}.`,
                    allowedMentions: { users: [member.id] }
                }).catch(() => {});
            } else {
                await textChannel.permissionOverwrites.delete(member)
                    .catch(console.error);
            }

            // Check if channel is empty
            if (voiceChannel.members.size === 0) {
                await this.purgeAndHideTextChannel(textChannel);
            }
        } catch (error) {
            console.error(`Error in updateTextChannelVisibility: ${error.message}`);
        }
    }

    async purgeAndHideTextChannel(textChannel) {
        try {
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const batchSize = 100;
            let totalDeleted = 0;

            while (true) {
                const messages = await textChannel.messages.fetch({ limit: batchSize });
                if (messages.size === 0) break;

                const recentMessages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);
                const oldMessages = messages.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

                if (recentMessages.size > 0) {
                    await textChannel.bulkDelete(recentMessages, true)
                        .catch(console.error);
                    totalDeleted += recentMessages.size;
                }

                for (const [, message] of oldMessages) {
                    await message.delete().catch(() => {});
                    totalDeleted++;
                }

                if (messages.size < batchSize) break;
            }

            await textChannel.permissionOverwrites.edit(textChannel.guild.roles.everyone, {
                ViewChannel: false,
            });

            console.log(`Cleaned up ${totalDeleted} messages from ${textChannel.name}`);
        } catch (error) {
            console.error(`Error in purgeAndHideTextChannel: ${error.message}`);
        }
    }

    async cleanupStaleChannels() {
        try {
            for (const [voiceId, textChannel] of this.voiceTextChannels) {
                const voiceChannel = this.client.channels.cache.get(voiceId);
                if (!voiceChannel || voiceChannel.members.size === 0) {
                    await this.purgeAndHideTextChannel(textChannel);
                    this.voiceTextChannels.delete(voiceId);
                }
            }
        } catch (error) {
            console.error(`Error in cleanupStaleChannels: ${error.message}`);
        }
    }
}

module.exports = VoiceTextChannelManager;
