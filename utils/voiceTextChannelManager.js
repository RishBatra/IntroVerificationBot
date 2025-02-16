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

    // Cleanup interval for stale channels (every 6 hours)
    setInterval(() => this.cleanupStaleChannels(), 6 * 60 * 60 * 1000);
    console.log('[VoiceTextChannelManager] Initialized.');
  }

  async getOrCreateTextChannel(voiceChannel) {
    console.log(`[VoiceTextChannelManager] getOrCreateTextChannel called for voice channel ID: ${voiceChannel.id}`);
    try {
      if (this.excludedChannels.includes(voiceChannel.id)) {
        console.log(`[VoiceTextChannelManager] Voice channel ${voiceChannel.id} is excluded.`);
        return null;
      }

      // Check cooldown to prevent spam
      const cooldown = this.channelCooldowns.get(voiceChannel.id);
      if (cooldown && Date.now() - cooldown < 10000) { // 10 seconds cooldown
        console.log(`[VoiceTextChannelManager] Cooldown active for voice channel ${voiceChannel.id}.`);
        return this.voiceTextChannels.get(voiceChannel.id);
      }

      // Update cooldown
      this.channelCooldowns.set(voiceChannel.id, Date.now());

      // Check cache first
      let textChannel = this.voiceTextChannels.get(voiceChannel.id);
      if (textChannel) {
        try {
          await textChannel.fetch();
          console.log(`[VoiceTextChannelManager] Found cached text channel for voice channel ${voiceChannel.id}.`);
          return textChannel;
        } catch {
          console.log(`[VoiceTextChannelManager] Cached text channel for ${voiceChannel.id} is invalid, deleting from cache.`);
          this.voiceTextChannels.delete(voiceChannel.id);
        }
      }

      // Look for existing channel in the same category (if available)
      textChannel = voiceChannel.parent?.children.cache.find(
        channel =>
          channel.type === ChannelType.GuildText &&
          channel.name === `${voiceChannel.name}-text`
      );

      if (textChannel) {
        console.log(`[VoiceTextChannelManager] Found existing text channel ${textChannel.id} for voice channel ${voiceChannel.id}.`);
        this.voiceTextChannels.set(voiceChannel.id, textChannel);
        return textChannel;
      }

      // Prepare channel creation data
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
        reason: `Voice text channel for ${voiceChannel.name}`,
      };

      // Set parent if the voice channel has one
      if (voiceChannel.parent) {
        channelData.parent = voiceChannel.parent;
      }

      console.log(`[VoiceTextChannelManager] Creating new text channel for voice channel ${voiceChannel.id}.`);
      textChannel = await voiceChannel.guild.channels.create(channelData);
      this.voiceTextChannels.set(voiceChannel.id, textChannel);
      console.log(`[VoiceTextChannelManager] Created text channel ${textChannel.id} for voice channel ${voiceChannel.id}.`);
      return textChannel;
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error in getOrCreateTextChannel: ${error.message}`);
      return null;
    }
  }

  async updateTextChannelVisibility(voiceChannel, member, joined) {
    console.log(`[VoiceTextChannelManager] updateTextChannelVisibility called for voice channel ${voiceChannel.id} and member ${member.id}. Joined: ${joined}`);
    try {
      if (this.excludedChannels.includes(voiceChannel.id)) {
        console.log(`[VoiceTextChannelManager] Voice channel ${voiceChannel.id} is excluded from text channel updates.`);
        return;
      }

      const textChannel = await this.getOrCreateTextChannel(voiceChannel);
      if (!textChannel) {
        console.log(`[VoiceTextChannelManager] No text channel found or created for voice channel ${voiceChannel.id}.`);
        return;
      }

      if (joined) {
        await textChannel.permissionOverwrites.edit(member, {
          ViewChannel: true,
          SendMessages: true,
        }).catch(console.error);

        console.log(`[VoiceTextChannelManager] Updated permissions for member ${member.id} in text channel ${textChannel.id}.`);

        // Send a welcome message
        await textChannel.send({
          content: `Welcome ${member}! This channel is linked to ${voiceChannel.name}.`,
          allowedMentions: { users: [member.id] },
        }).catch((err) => console.error(`[VoiceTextChannelManager] Failed to send welcome message: ${err}`));
      } else {
        await textChannel.permissionOverwrites.delete(member)
          .catch(console.error);
        console.log(`[VoiceTextChannelManager] Removed permissions for member ${member.id} in text channel ${textChannel.id}.`);
      }

      // If the voice channel is empty, purge messages and hide the text channel
      if (voiceChannel.members.size === 0) {
        console.log(`[VoiceTextChannelManager] Voice channel ${voiceChannel.id} is empty. Purging and hiding text channel ${textChannel.id}.`);
        await this.purgeAndHideTextChannel(textChannel);
      }
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error in updateTextChannelVisibility: ${error.message}`);
    }
  }

  // Purges messages then hides the text channel from everyone
  async purgeAndHideTextChannel(textChannel) {
    console.log(`[VoiceTextChannelManager] purgeAndHideTextChannel called for ${textChannel.id}.`);
    try {
      await this.purgeChannelMessages(textChannel); // Purge messages first
      // Then hide the channel
      await textChannel.permissionOverwrites.edit(textChannel.guild.roles.everyone, {
        ViewChannel: false,
      });
      console.log(`[VoiceTextChannelManager] Purged messages and hid text channel ${textChannel.id}.`);
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error in purgeAndHideTextChannel: ${error.message}`);
    }
  }

  // Purge messages in the text channel without hiding it
  async purgeChannelMessages(textChannel) {
    console.log(`[VoiceTextChannelManager] purgeChannelMessages called for ${textChannel.id}.`);
    try {
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const batchSize = 100;
      let totalDeleted = 0;

      while (true) {
        const messages = await textChannel.messages.fetch({ limit: batchSize });
        if (messages.size === 0) break;

        // Filter messages by age
        const recentMessages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);
        const oldMessages = messages.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

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
          console.log(`[VoiceTextChannelManager] Cleaning up text channel ${textChannel.id} for stale voice channel ${voiceId}.`);
          await this.purgeAndHideTextChannel(textChannel);
          this.voiceTextChannels.delete(voiceId);
        }
      }
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error in cleanupStaleChannels: ${error.message}`);
    }
  }
}

module.exports = VoiceTextChannelManager;