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
    this.videoEventCategories = new Set(['Video Events', '🎥 Video Event']);
    console.log('[VoiceTextChannelManager] Initialized.');
  }

  async getOrCreateTextChannel(voiceChannel) {
    if (!voiceChannel) {
      console.log('[VoiceTextChannelManager] No voice channel provided');
      return null;
    }

    console.log(`[VoiceTextChannelManager] Processing channel: ${voiceChannel.name} (${voiceChannel.id})`);
    console.log(`[VoiceTextChannelManager] Category: ${voiceChannel.parent?.name || 'No category'}`);

    try {
      // Skip if channel is in a video event category
      if (voiceChannel.parent && this.videoEventCategories.has(voiceChannel.parent.name)) {
        console.log(`[VoiceTextChannelManager] Skipping video event category channel ${voiceChannel.id}`);
        return null;
      }

      // Skip if channel is excluded
      if (this.excludedChannels.includes(voiceChannel.id)) {
        console.log(`[VoiceTextChannelManager] Channel ${voiceChannel.id} is excluded`);
        return null;
      }

      // Check cooldown
      const cooldown = this.channelCooldowns.get(voiceChannel.id);
      if (cooldown && Date.now() - cooldown < 10000) {
        console.log(`[VoiceTextChannelManager] Cooldown active for channel ${voiceChannel.id}`);
        return this.voiceTextChannels.get(voiceChannel.id);
      }

      // Update cooldown
      this.channelCooldowns.set(voiceChannel.id, Date.now());

      // Check existing channel in cache
      let textChannel = this.voiceTextChannels.get(voiceChannel.id);
      if (textChannel) {
        try {
          await textChannel.fetch();
          console.log(`[VoiceTextChannelManager] Found existing text channel ${textChannel.id}`);
          return textChannel;
        } catch (error) {
          console.log(`[VoiceTextChannelManager] Cached channel invalid, removing from cache`);
          this.voiceTextChannels.delete(voiceChannel.id);
        }
      }

      // Look for existing text channel in category
      if (voiceChannel.parent) {
        textChannel = voiceChannel.parent.children.cache.find(
          channel => 
            channel.type === ChannelType.GuildText && 
            channel.name === `${voiceChannel.name}-text`
        );
        
        if (textChannel) {
          console.log(`[VoiceTextChannelManager] Found existing category text channel ${textChannel.id}`);
          this.voiceTextChannels.set(voiceChannel.id, textChannel);
          return textChannel;
        }
      }

      // Create new text channel
      console.log(`[VoiceTextChannelManager] Creating new text channel for ${voiceChannel.name}`);
      const channelData = {
        name: `${voiceChannel.name}-text`,
        type: ChannelType.GuildText,
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
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ],
      };

      // Set parent if the voice channel has one
      if (voiceChannel.parent) {
        channelData.parent = voiceChannel.parent;
      }

      textChannel = await voiceChannel.guild.channels.create(channelData);
      this.voiceTextChannels.set(voiceChannel.id, textChannel);
      console.log(`[VoiceTextChannelManager] Created new text channel ${textChannel.id}`);
      return textChannel;
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error: ${error.message}`);
      return null;
    }
  }

  async updateTextChannelVisibility(voiceChannel, member, joined) {
    if (!voiceChannel || !member) return;

    console.log(`[VoiceTextChannelManager] Updating visibility for ${member.user.tag} in ${voiceChannel.name}`);

    try {
      const textChannel = await this.getOrCreateTextChannel(voiceChannel);
      if (!textChannel) return;

      if (joined) {
        await textChannel.permissionOverwrites.edit(member, {
          ViewChannel: true,
          SendMessages: true,
        });
        console.log(`[VoiceTextChannelManager] Granted access to ${member.user.tag}`);

        await textChannel.send({
          content: `Welcome ${member}! This channel is linked to ${voiceChannel.name}.`,
          allowedMentions: { users: [member.id] },
        }).catch(console.error);
      } else {
        await textChannel.permissionOverwrites.edit(member, {
          ViewChannel: false,
        });
        console.log(`[VoiceTextChannelManager] Removed access from ${member.user.tag}`);
      }

      // If voice channel is empty, purge messages
      if (voiceChannel.members.size === 0) {
        await this.purgeChannelMessages(textChannel);
      }
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error updating visibility: ${error.message}`);
    }
  }

  async purgeChannelMessages(textChannel) {
    if (!textChannel) return;
    
    try {
      const messages = await textChannel.messages.fetch();
      if (messages.size > 0) {
        await textChannel.bulkDelete(messages, true).catch(() => {
          // If bulk delete fails, delete messages one by one
          messages.forEach(msg => msg.delete().catch(() => {}));
        });
      }
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error purging messages: ${error.message}`);
    }
  }

  async cleanupStaleChannels() {
    console.log('[VoiceTextChannelManager] Cleaning up stale channels');
    for (const [voiceId, textChannel] of this.voiceTextChannels) {
      try {
        const voiceChannel = await this.client.channels.fetch(voiceId).catch(() => null);
        if (!voiceChannel || voiceChannel.members.size === 0) {
          await this.purgeChannelMessages(textChannel);
          this.voiceTextChannels.delete(voiceId);
        }
      } catch (error) {
        console.error(`[VoiceTextChannelManager] Error cleaning up channel: ${error.message}`);
      }
    }
  }
}

module.exports = VoiceTextChannelManager;