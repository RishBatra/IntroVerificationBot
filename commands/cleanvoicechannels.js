const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanvoicechannels')
        .setDescription('Manually cleanup all voice-text channels')
        .addBooleanOption(option =>
            option.setName('force')
                .setDescription('Force delete all voice-text channels regardless of voice channel status')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;
            const forceDelete = interaction.options.getBoolean('force') || false;
            let deletedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            // Get all text channels that end with '-text'
            const textChannels = guild.channels.cache.filter(
                channel => channel.type === 0 && channel.name && channel.name.endsWith('-text')
            );

            await interaction.editReply(`Found ${textChannels.size} voice-text channels. Starting cleanup...${forceDelete ? ' (FORCE MODE)' : ''}`);

            for (const [, channel] of textChannels) {
                try {
                    // Get the corresponding voice channel name
                    const voiceChannelName = channel.name.replace('-text', '');
                    
                    // Find the corresponding voice channel
                    const voiceChannel = guild.channels.cache.find(
                        ch => ch.type === 2 && ch.name === voiceChannelName && ch.parent === channel.parent
                    );

                    // Delete if force mode, or if voice channel doesn't exist or is empty
                    if (forceDelete || !voiceChannel || voiceChannel.members.size === 0) {
                        // Clear messages first
                        try {
                            const messages = await channel.messages.fetch({ limit: 100 });
                            if (messages.size > 0) {
                                await channel.bulkDelete(messages, true)
                                    .catch(() => {});
                            }
                        } catch (error) {
                            console.error(`Error deleting messages in ${channel.name}:`, error);
                        }

                        // Delete the channel
                        await channel.delete('Voice-text channel cleanup');
                        deletedCount++;
                        console.log(`[CleanupCommand] Deleted text channel: ${channel.name}`);
                        
                        // Add a small delay to prevent rate limiting
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        skippedCount++;
                    }
                } catch (error) {
                    console.error(`Error processing ${channel.name}:`, error);
                    errorCount++;
                }
            }

            // Also clean up the VoiceTextChannelManager cache
            const voiceTextManager = interaction.client.voiceTextManager;
            if (voiceTextManager) {
                for (const [voiceId, textChannel] of voiceTextManager.voiceTextChannels) {
                    try {
                        // Check if text channel still exists
                        const channelExists = guild.channels.cache.has(textChannel.id);
                        if (!channelExists) {
                            voiceTextManager.voiceTextChannels.delete(voiceId);
                            console.log(`[CleanupCommand] Removed stale cache entry for voice channel ${voiceId}`);
                        }
                    } catch (error) {
                        console.error(`Error cleaning cache for voice channel ${voiceId}:`, error);
                    }
                }
            }

            // Send final report
            const report = [
                `Cleanup completed!`,
                `• Deleted: ${deletedCount} channels`,
                `• Skipped: ${skippedCount} active channels`,
                errorCount > 0 ? `• Errors: ${errorCount} channels` : '',
                forceDelete ? '• Force mode was enabled' : '',
            ].filter(Boolean).join('\n');

            await interaction.editReply(report);

        } catch (error) {
            console.error('Error in cleanup command:', error);
            await interaction.editReply('An error occurred while cleaning up channels.');
        }
    }
};