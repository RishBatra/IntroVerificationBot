const { ChannelType, PermissionFlagsBits } = require('discord.js');

class VoiceTextChannelManager {
    constructor(client) {
        this.client = client;
        this.voiceTextChannels = new Map();
        // Add an array of voice channel IDs to exclude
        this.excludedChannels = [
            '693018400259047444', // Replace with actual channel IDs
            '693034620618539068',
            // Add more channel IDs as needed
        ];
    }

    async getOrCreateTextChannel(voiceChannel) {
        // Check if the voice channel is in the excluded list
        if (this.excludedChannels.includes(voiceChannel.id)) {
            console.log(`Skipping excluded channel: ${voiceChannel.name} (${voiceChannel.id})`);
            return null;
        }

        const existingChannel = this.voiceTextChannels.get(voiceChannel.id);
        if (existingChannel) return existingChannel;

        // Check for existing Nexus bot channel
        const nexusChannel = voiceChannel.parent.children.cache.find(
            channel => channel.type === ChannelType.GuildText && channel.name === `${voiceChannel.name}-text`
        );

        if (nexusChannel) {
            this.voiceTextChannels.set(voiceChannel.id, nexusChannel);
            return nexusChannel;
        }

        // Create new text channel
        const textChannel = await voiceChannel.guild.channels.create({
            name: `${voiceChannel.name}-text`,
            type: ChannelType.GuildText,
            parent: voiceChannel.parent,
            permissionOverwrites: [
                {
                    id: voiceChannel.guild.roles.everyone,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
            ],
        });

        this.voiceTextChannels.set(voiceChannel.id, textChannel);
        return textChannel;
    }

    async updateTextChannelVisibility(voiceChannel, member, joined) {
        // Check if the voice channel is in the excluded list
        if (this.excludedChannels.includes(voiceChannel.id)) {
            console.log(`Skipping visibility update for excluded channel: ${voiceChannel.name} (${voiceChannel.id})`);
            return;
        }

        const textChannel = await this.getOrCreateTextChannel(voiceChannel);
        if (!textChannel) return; // Skip if no text channel (e.g., for excluded voice channels)

        if (joined) {
            await textChannel.permissionOverwrites.edit(member, {
                ViewChannel: true,
                SendMessages: true,
            });
        } else {
            await textChannel.permissionOverwrites.delete(member);
        }

        if (voiceChannel.members.size === 0) {
            await this.purgeAndHideTextChannel(textChannel);
        }
    }

    async purgeAndHideTextChannel(textChannel) {
        try {
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            let messagesDeleted = 0;

            // Fetch messages
            const messages = await textChannel.messages.fetch({ limit: 100 });
            
            // Separate recent and old messages
            const recentMessages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);
            const oldMessages = messages.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

            // Bulk delete recent messages if any
            if (recentMessages.size > 0) {
                await textChannel.bulkDelete(recentMessages);
                messagesDeleted += recentMessages.size;
                console.log(`Bulk deleted ${recentMessages.size} recent messages from ${textChannel.name}`);
            }

            // Delete old messages one by one
            for (const message of oldMessages.values()) {
                await message.delete().catch(console.error);
                messagesDeleted++;
            }

            console.log(`Deleted ${oldMessages.size} old messages individually from ${textChannel.name}`);
            console.log(`Total messages deleted from ${textChannel.name}: ${messagesDeleted}`);

        } catch (error) {
            console.error('Error purging messages:', error);
        }

        // Hide the channel
        await textChannel.permissionOverwrites.edit(textChannel.guild.roles.everyone, {
            ViewChannel: false,
        });
    }
}

module.exports = VoiceTextChannelManager;