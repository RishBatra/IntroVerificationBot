const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pendingverifications')
        .setDescription('Shows all pending verifications')
        .addBooleanOption(option =>
            option.setName('include_archived')
                .setDescription('Include archived verification threads')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Check if user has required roles
        const executor = interaction.member;
        const adminRole = 'Admins';
        const proudGuardiansRole = 'Proud Guardians';

        if (!executor.roles.cache.some(role => role.name === adminRole || role.name === proudGuardiansRole)) {
            return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const verificationHelpChannel = interaction.guild.channels.cache.find(channel => channel.name === 'verification-help');
        if (!verificationHelpChannel) {
            return interaction.editReply({ content: 'Verification-help channel not found.', ephemeral: true });
        }

        // Fetch both active and archived threads if requested
        const includeArchived = interaction.options.getBoolean('include_archived') ?? false;
        
        let allThreads = new Map();
        
        // Fetch active threads
        const activeThreads = await verificationHelpChannel.threads.fetchActive();
        activeThreads.threads.forEach(thread => allThreads.set(thread.id, thread));

        // Fetch archived threads if requested
        if (includeArchived) {
            try {
                const archivedThreads = await verificationHelpChannel.threads.fetchArchived();
                archivedThreads.threads.forEach(thread => allThreads.set(thread.id, thread));
            } catch (error) {
                console.error('Error fetching archived threads:', error);
            }
        }

        if (allThreads.size === 0) {
            return interaction.editReply({ 
                content: includeArchived 
                    ? 'No verification threads found.' 
                    : 'No active verification threads found. Try using `/pendingverifications include_archived:true` to see archived threads.',
                ephemeral: true 
            });
        }

        // Sort threads by creation date (newest first)
        const sortedThreads = Array.from(allThreads.values())
            .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

        // Create embeds with 25 fields each
        const embeds = [];
        let currentEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(includeArchived ? 'All Verification Threads' : 'Active Verification Threads')
            .setDescription('Here are the verification threads:')
            .setTimestamp();

        let fieldCount = 0;
        
        sortedThreads.forEach((thread, index) => {
            const userName = thread.name.replace('Verification - ', '');
            const status = thread.archived ? '🔒 Archived' : '🔓 Active';
            
            // If we've reached 25 fields, create a new embed
            if (fieldCount === 25) {
                embeds.push(currentEmbed);
                currentEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`${includeArchived ? 'All' : 'Active'} Verification Threads (Continued)`)
                    .setTimestamp();
                fieldCount = 0;
            }

            currentEmbed.addFields({
                name: `${status} | ${userName}`,
                value: `[Go to thread](https://discord.com/channels/${interaction.guildId}/${thread.id})\nCreated: <t:${Math.floor(thread.createdTimestamp / 1000)}:R>`
            });
            fieldCount++;
        });

        // Add the last embed if it has any fields
        if (fieldCount > 0) {
            embeds.push(currentEmbed);
        }

        // Add footer to the last embed
        embeds[embeds.length - 1].setFooter({ 
            text: `Total threads: ${allThreads.size} | Active: ${activeThreads.threads.size} | Archived: ${allThreads.size - activeThreads.threads.size}` 
        });

        // Add page numbers to embeds
        embeds.forEach((embed, index) => {
            embed.setDescription(`Here are the verification threads (Page ${index + 1}/${embeds.length}):`);
        });

        await interaction.editReply({ embeds: embeds, ephemeral: true });
    },
}; 