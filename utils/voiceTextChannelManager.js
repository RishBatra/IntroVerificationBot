const { ChannelType, PermissionFlagsBits } = require('discord.js');

class VoiceTextChannelManager {
    constructor(client) {
        this.client = client;
        this.voiceTextChannels = new Map();
    }

    async getOrCreateTextChannel(voiceChannel) {
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
        const textChannel = await this.getOrCreateTextChannel(voiceChannel);

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
            await textChannel.bulkDelete(100);
        } catch (error) {
            console.error('Error purging messages:', error);
        }

        await textChannel.permissionOverwrites.edit(textChannel.guild.roles.everyone, {
            ViewChannel: false,
        });
    }
}

module.exports = VoiceTextChannelManager;