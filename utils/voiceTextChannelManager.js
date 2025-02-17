const { ChannelType, PermissionFlagsBits, Collection } = require('discord.js');

class VoiceTextChannelManager {
  constructor(client) {
    console.log('[VoiceTextChannelManager] Starting initialization...');
    this.client = client;
    this.voiceTextChannels = new Collection();
    this.channelCooldowns = new Collection();
    this.excludedChannels = [
      '693018400259047444',
      '693034620618539068',
    ];
    this.videoEventCategories = new Set(['Video Events', '🎥 Video Event']);
    console.log('[VoiceTextChannelManager] Initialization complete.');

    // Cleanup interval for stale channels (every 6 hours)
    setInterval(() => this.cleanupStaleChannels(), 6 * 60 * 60 * 1000);
    console.log('[VoiceTextChannelManager] Initialized.');
  }

  async getOrCreateTextChannel(voiceChannel) {
    console.log(`[VoiceTextChannelManager] getOrCreateTextChannel called for ${voiceChannel?.name}`);

    if (!voiceChannel) {
      console.log('[VoiceTextChannelManager] No voice channel provided');
      return null;
    }

    try {
      // Skip if channel is in a video event category
      if (voiceChannel.parent && this.videoEventCategories.has(voiceChannel.parent.name)) {
        console.log(`[VoiceTextChannelManager] Channel in video event category, skipping`);
        return null;
      }

      // Skip if channel is excluded
      if (this.excludedChannels.includes(voiceChannel.id)) {
        console.log(`[VoiceTextChannelManager] Channel is excluded`);
        return null;
      }

      console.log('[VoiceTextChannelManager] Creating channel data...');
      const channelData = {
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
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ],
      };

      console.log('[VoiceTextChannelManager] Creating new text channel...');
      const textChannel = await voiceChannel.guild.channels.create(channelData);
      console.log(`[VoiceTextChannelManager] Created text channel: ${textChannel.name}`);
      
      this.voiceTextChannels.set(voiceChannel.id, textChannel);
      return textChannel;
    } catch (error) {
      console.error('[VoiceTextChannelManager] Error in getOrCreateTextChannel:', error);
      return null;
    }
  }

  async updateTextChannelVisibility(voiceChannel, member, joined) {
    console.log(`[VoiceTextChannelManager] updateTextChannelVisibility called`);
    console.log(`[VoiceTextChannelManager] Channel: ${voiceChannel?.name}, Member: ${member?.user?.tag}, Joined: ${joined}`);

    if (!voiceChannel || !member) {
      console.log('[VoiceTextChannelManager] Missing voiceChannel or member');
      return;
    }

    try {
      console.log('[VoiceTextChannelManager] Getting or creating text channel...');
      const textChannel = await this.getOrCreateTextChannel(voiceChannel);
      
      if (!textChannel) {
        console.log('[VoiceTextChannelManager] No text channel created/found');
        return;
      }

      if (joined) {
        console.log(`[VoiceTextChannelManager] Granting access to ${member.user.tag}`);
        await textChannel.permissionOverwrites.edit(member, {
          ViewChannel: true,
          SendMessages: true,
        });

        await textChannel.send({
          content: `Welcome ${member}! This channel is linked to ${voiceChannel.name}.`,
          allowedMentions: { users: [member.id] },
        });
      } else {
        console.log(`[VoiceTextChannelManager] Removing access from ${member.user.tag}`);
        await textChannel.permissionOverwrites.edit(member, {
          ViewChannel: false,
        });
      }

      if (voiceChannel.members.size === 0) {
        console.log('[VoiceTextChannelManager] Channel empty, purging messages');
        await this.purgeChannelMessages(textChannel);
      }
    } catch (error) {
      console.error('[VoiceTextChannelManager] Error in updateTextChannelVisibility:', error);
    }
  }

  // Purge messages in the text channel (without hiding the channel)
  async purgeChannelMessages(textChannel) {
    console.log(`[VoiceTextChannelManager] purgeChannelMessages called for ${textChannel.id}.`);
    try {
      const batchSize = 100;
      let totalDeleted = 0;

      while (true) {
        const messages = await textChannel.messages.fetch({ limit: batchSize });
        if (messages.size === 0) break;

        // Bulk delete messages younger than 14 days, and delete older ones individually.
        const recentMessages = messages.filter(msg => Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
        const oldMessages = messages.filter(msg => Date.now() - msg.createdTimestamp >= 14 * 24 * 60 * 60 * 1000);

        if (recentMessages.size > 0) {
          await textChannel.bulkDelete(recentMessages, true).catch(console.error);
          totalDeleted += recentMessages.size;
        }

        for (const [, message] of oldMessages) {
          await message.delete().catch(() => {});
          totalDeleted++;
        }

        if (messages.size < batchSize) break;
      }
      console.log(`[VoiceTextChannelManager] Purged ${totalDeleted} messages from ${textChannel.name} (${textChannel.id}).`);
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error purging messages in ${textChannel.id}: ${error.message}`);
    }
  }

  async cleanupStaleChannels() {
    console.log(`[VoiceTextChannelManager] Running cleanup of stale channels.`);
    try {
      for (const [voiceId, textChannel] of this.voiceTextChannels) {
        const voiceChannel = this.client.channels.cache.get(voiceId);
        if (!voiceChannel || voiceChannel.members.size === 0) {
          console.log(`[VoiceTextChannelManager] Cleaning up text channel ${textChannel.id} for stale voice channel ${voiceId}. Purging messages.`);
          await this.purgeChannelMessages(textChannel);
          this.voiceTextChannels.delete(voiceId);
        }
      }
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error in cleanupStaleChannels: ${error.message}`);
    }
  }
}

module.exports = VoiceTextChannelManager;