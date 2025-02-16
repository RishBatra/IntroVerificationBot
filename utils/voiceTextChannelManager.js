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
        
        console.log("[INIT] VoiceTextChannelManager initialized");

        // Run cleanup every 6 hours
        setInterval(() => this.cleanupStaleChannels(), 6 * 60 * 60 * 1000);
    }

    async getOrCreateTextChannel(voiceChannel) {
        try {
            console.log(`[DEBUG] getOrCreateTextChannel called for: ${voiceChannel.name} (${voiceChannel.id})`);

            // Check if this channel is excluded
            const event = await this.client.videoEventDB?.findOne({ guildId: voiceChannel.guild.id });
            if (this.excludedChannels.includes(voiceChannel.id) || 
                voiceChannel.parent?.name === 'Video Events' || 
                (event && [event.videoChannelId, event.waitingRoomId].includes(voiceChannel.id))) {
                console.log(`[DEBUG] Excluding channel: ${voiceChannel.name} (${voiceChannel.id})`);
                return null;
            }

            // Prevent rapid-fire calls
            const cooldown = this.channelCooldowns.get(voiceChannel.id);
            if (cooldown && Date.now() - cooldown < 10000) { // 10-second cooldown
                console.log(`[DEBUG] Skipping due to cooldown: ${voiceChannel.name} (${voiceChannel.id})`);
                return this.voiceTextChannels.get(voiceChannel.id);
            }
            this.channelCooldowns.set(voiceChannel.id, Date.now());

            // Check cache
            let textChannel = this.voiceTextChannels.get(voiceChannel.id);
            if (textChannel) {
                try {
                    await textChannel.fetch();
                    console.log(`[DEBUG] Using cached text channel: ${textChannel.name} (${textChannel.id})`);
                    return textChannel;
                } catch {
                    console.log(`[DEBUG] Cached text channel no longer exists. Removing from cache.`);
                    this.voiceTextChannels.delete(voiceChannel.id);
                }
            }

            // Try to find an existing text channel
            textChannel = voiceChannel.parent?.children.cache.find(
                channel =>
                    channel.type === ChannelType.GuildText &&
                    channel.name === `${voiceChannel.name}-text`
            );
            if (textChannel) {
                console.log(`[DEBUG] Found existing text channel: ${textChannel.name} (${textChannel.id})`);
                this.voiceTextChannels.set(voiceChannel.id, textChannel);
                return textChannel;
            }

            // Create a new text channel
            console.log(`[DEBUG] Creating new text channel for: ${voiceChannel.name}`);
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

            console.log(`[DEBUG] Created new text channel: ${textChannel.name} (${textChannel.id})`);
            this.voiceTextChannels.set(voiceChannel.id, textChannel);
            return textChannel;
        } catch (error) {
            console.error(`[ERROR] getOrCreateTextChannel: ${error.message}`);
            return null;
        }
    }

    async updateTextChannelVisibility(voiceChannel, member, joined) {
        try {
            console.log(`[DEBUG] updateTextChannelVisibility called for: ${voiceChannel.name} (${voiceChannel.id}) - Joined: ${joined}`);

            if (this.excludedChannels.includes(voiceChannel.id)) return;

            const textChannel = await this.getOrCreateTextChannel(voiceChannel);
            if (!textChannel) {
                console.log(`[DEBUG] No text channel found for: ${voiceChannel.name}`);
                return;
            }

            if (joined) {
                console.log(`[DEBUG] Granting ${member.user.tag} access to ${textChannel.name}`);
                await textChannel.permissionOverwrites.edit(member, {
                    ViewChannel: true,
                    SendMessages: true,
                }).catch(console.error);

                await textChannel.send({
                    content: `Welcome ${member}! This channel is linked to ${voiceChannel.name}.`,
                    allowedMentions: { users: [member.id] }
                }).catch(() => {});
            } else {
                console.log(`[DEBUG] Removing ${member.user.tag} access from ${textChannel.name}`);
                await textChannel.permissionOverwrites.delete(member).catch(console.error);
            }

            if (voiceChannel.members.size === 0) {
                console.log(`[DEBUG] Voice channel empty, purging messages in ${textChannel.name}`);
                await this.purgeChannelMessages(textChannel);
            }
        } catch (error) {
            console.error(`[ERROR] updateTextChannelVisibility: ${error.message}`);
        }
    }

    async purgeChannelMessages(textChannel) {
        try {
            console.log(`[DEBUG] Purging messages in: ${textChannel.name}`);
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
                            console.log('[DEBUG] Attempted to delete already deleted messages.');
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

            console.log(`[DEBUG] Purged ${totalDeleted} messages from ${textChannel.name}`);
        } catch (error) {
            console.error(`[ERROR] purgeChannelMessages: ${error.message}`);
        }
    }

    async cleanupStaleChannels() {
        try {
            console.log('[DEBUG] Running cleanupStaleChannels...');

            for (const [voiceId, textChannel] of this.voiceTextChannels) {
                const voiceChannel = this.client.channels.cache.get(voiceId);
                if (!voiceChannel || voiceChannel.members.size === 0) {
                    console.log(`[DEBUG] Purging stale text channel: ${textChannel.name}`);
                    await this.purgeChannelMessages(textChannel);
                }
            }
        } catch (error) {
            console.error(`[ERROR] cleanupStaleChannels: ${error.message}`);
        }
    }
}

module.exports = VoiceTextChannelManager;