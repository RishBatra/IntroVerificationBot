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
    this.excludedCategories = [
      '860846438262505482',
    ];

    // Cleanup interval for stale channels (every 6 hours)
    setInterval(() => this.cleanupStaleChannels(), 6 * 60 * 60 * 1000);
    console.log('[VoiceTextChannelManager] Initialized.');
  }

  async getOrCreateTextChannel(voiceChannel) {
    if (!voiceChannel) {
      console.log('[VoiceTextChannelManager] No voice channel provided');
      return null;
    }

    try {
      // Skip if channel is excluded
      if (this.excludedChannels.includes(voiceChannel.id)) {
        console.log(`[VoiceTextChannelManager] Voice channel ${voiceChannel.id} is excluded from text channel updates.`);
        return null;
      }
      
      // Skip if channel is in an excluded category
      if (voiceChannel.parent && this.excludedCategories.includes(voiceChannel.parent.id)) {
        console.log(`[VoiceTextChannelManager] Voice channel ${voiceChannel.id} is in excluded category ${voiceChannel.parent.id}.`);
        return null;
      }

      // Check for existing text channel in cache or find it
      const existingChannel = this.voiceTextChannels.get(voiceChannel.id) || 
        voiceChannel.guild.channels.cache.find(
          channel => channel.name === `${voiceChannel.name}-text` && 
          channel.parent === voiceChannel.parent
        );

      if (existingChannel) {
        console.log(`[VoiceTextChannelManager] Found existing text channel ${existingChannel.id} for voice channel ${voiceChannel.id}.`);
        this.voiceTextChannels.set(voiceChannel.id, existingChannel);
        return existingChannel;
      }

      // Create new text channel
      console.log(`[VoiceTextChannelManager] Creating new text channel for ${voiceChannel.name}`);
      const newChannel = await voiceChannel.guild.channels.create({
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
      });

      this.voiceTextChannels.set(voiceChannel.id, newChannel);
      return newChannel;

    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error: ${error.message}`);
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
      
      // Skip if channel is in an excluded category
      if (voiceChannel.parent && this.excludedCategories.includes(voiceChannel.parent.id)) {
        console.log(`[VoiceTextChannelManager] Voice channel ${voiceChannel.id} is in excluded category ${voiceChannel.parent.id}.`);
        return;
      }

      const textChannel = await this.getOrCreateTextChannel(voiceChannel);
      if (!textChannel) {
        console.log(`[VoiceTextChannelManager] No text channel found or created for voice channel ${voiceChannel.id}.`);
        return;
      }

      if (joined) {
        // Grant permission so the member can see and use the text channel.
        await textChannel.permissionOverwrites.edit(member, {
          ViewChannel: true,
          SendMessages: true,
        }).catch(console.error);
        console.log(`[VoiceTextChannelManager] Granted permissions for member ${member.id} in text channel ${textChannel.id}.`);

        // Send a welcome message
        await textChannel.send({
          content: `Welcome ${member}! This channel is linked to ${voiceChannel.name}.`,
          allowedMentions: { users: [member.id] },
        }).catch((err) => console.error(`[VoiceTextChannelManager] Failed to send welcome message: ${err}`));
      } else {
        // When the member leaves, explicitly deny their permission to view the text channel.
        await textChannel.permissionOverwrites.edit(member, { ViewChannel: false }).catch(console.error);
        console.log(`[VoiceTextChannelManager] Set deny for member ${member.id} in text channel ${textChannel.id}.`);
      }

      // If the voice channel is empty, delete the text channel after a short delay
      if (voiceChannel.members.size === 0) {
        console.log(`[VoiceTextChannelManager] Voice channel ${voiceChannel.id} is empty. Scheduling text channel deletion.`);
        setTimeout(async () => {
          // Double-check that the voice channel is still empty
          const updatedVoiceChannel = this.client.channels.cache.get(voiceChannel.id);
          if (!updatedVoiceChannel || updatedVoiceChannel.members.size === 0) {
            console.log(`[VoiceTextChannelManager] Deleting empty text channel ${textChannel.id}.`);
            try {
              await textChannel.delete('Voice channel is empty');
              this.voiceTextChannels.delete(voiceChannel.id);
            } catch (error) {
              console.error(`[VoiceTextChannelManager] Error deleting text channel ${textChannel.id}: ${error.message}`);
            }
          }
        }, 5000); // 5 second delay to handle rapid join/leave events
      }
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error in updateTextChannelVisibility: ${error.message}`);
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
          console.log(`[VoiceTextChannelManager] Cleaning up stale text channel ${textChannel.id} for voice channel ${voiceId}.`);
          try {
            await textChannel.delete('Stale voice-text channel cleanup');
            console.log(`[VoiceTextChannelManager] Deleted stale text channel ${textChannel.id}.`);
          } catch (error) {
            console.error(`[VoiceTextChannelManager] Error deleting stale text channel ${textChannel.id}: ${error.message}`);
          }
          this.voiceTextChannels.delete(voiceId);
        }
      }
    } catch (error) {
      console.error(`[VoiceTextChannelManager] Error in cleanupStaleChannels: ${error.message}`);
    }
  }
}

module.exports = VoiceTextChannelManager;