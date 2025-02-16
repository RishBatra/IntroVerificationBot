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
            // Exclude video event channels
            const event = await this.client.videoEventDB.findOne({ guildId: voiceChannel.guild.id });
            if (this.excludedChannels.includes(voiceChannel.id) || 
                voiceChannel.parent?.name === 'Video Events' || 
                (event && [event.videoChannelId, event.waitingRoomId].includes(voiceChannel.id))) {
                return null;
            }

            // Prevent rapid-fire calls
            const cooldown = this.channelCooldowns.get(voiceChannel.id);
            if (cooldown && Date.now() - cooldown < 10000) { // 10-second cooldown
                return this.voiceTextChannels.get(voiceChannel.id);
            }
            this.channelCooldowns.set(voiceChannel.id, Date.now());

            // Check cache
            let textChannel = this.voiceTextChannels.get(voiceChannel.id);
            if (textChannel) {
                try {
                    await textChannel.fetch();
                    return textChannel;
                } catch {
                    this.voiceTextChannels.delete(voiceChannel.id);
                }
            }

            // Try to find an existing channel
            textChannel = voiceChannel.parent?.children.cache.find(
                channel =>
                    channel.type === ChannelType.GuildText &&
                    channel.name === `${voiceChannel.name}-text`
            );
            if (textChannel) {
                this.voiceTextChannels.set(voiceChannel.id, textChannel);
                return textChannel;
            }

            // Create new text channel
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
                await textChannel.permissionOverwrites.edit(member, {
                    ViewChannel: true,
                    SendMessages: true,
                }).catch(console.error);

                await textChannel.send({
                    content: `Welcome ${member}! This channel is linked to ${voiceChannel.name}.`,
                    allowedMentions: { users: [member.id] }
                }).catch(() => {});
            } else {
                await textChannel.permissionOverwrites.delete(member).catch(console.error);
            }

            if (voiceChannel.members.size === 0) {
                await this.purgeChannelMessages(textChannel);
            }
        } catch (error) {
            console.error(`Error in updateTextChannelVisibility: ${error.message}`);
        }
    }

    async purgeChannelMessages(textChannel) {
        try {
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const batchSize = 100;
            let totalDeleted = 0;

            while (true) {
                const messages = await textChannel.messages.fetch({ limit: batchSize });
                if (messages.size === 0) break;

                const recentMessages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);
                if (recentMessages.size > 0) {
                    try {
                        await textChannel.bulkDelete(recentMessages, true);
                    } catch (error) {
                        if (error.code === 10008) {
                            console.log('Attempted to delete already deleted messages, continuing...');
                        } else {
                            throw error;
                        }
                    }
                    totalDeleted += recentMessages.size;
                }

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
}

module.exports = VoiceTextChannelManager;