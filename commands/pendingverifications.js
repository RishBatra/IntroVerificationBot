const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

        // Split threads into chunks of 10 for each page
        const threadsPerPage = 10;
        const pages = [];
        
        // Create pages sequentially to handle async operations
        for (let i = 0; i < sortedThreads.length; i += threadsPerPage) {
            const pageThreads = sortedThreads.slice(i, i + threadsPerPage);
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(includeArchived ? 'All Verification Threads' : 'Active Verification Threads')
                .setDescription(`Page ${Math.floor(i / threadsPerPage) + 1}/${Math.ceil(sortedThreads.length / threadsPerPage)}`)
                .setTimestamp();

            // Process each thread in the page
            const threadPromises = pageThreads.map(async thread => {
                const userName = thread.name.replace('Verification - ', '');
                const status = thread.archived ? '🔒' : '🔓';

                // Try to get the first message to find who started the verification
                let verifierInfo = '';
                try {
                    const messages = await thread.messages.fetch({ limit: 10 });
                    const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                    
                    // Find the first non-system message that contains the verification questions
                    const firstMessage = sortedMessages.find(msg => 
                        msg.embeds.length > 0 && 
                        msg.embeds[0].title === 'Verification Questions'
                    );

                    if (firstMessage) {
                        const verifierMatch = firstMessage.embeds[0].description.match(/<@(\d+)>/);
                        if (verifierMatch) {
                            const verifierId = verifierMatch[1];
                            const verifier = await interaction.guild.members.fetch(verifierId);
                            verifierInfo = `\nVerifier: ${verifier.nickname || verifier.user.username}`;
                        }
                    }
                } catch (error) {
                    console.error('Error fetching thread messages:', error);
                    verifierInfo = '\nVerifier: Unknown';
                }

                return {
                    name: `${status} ${userName}`,
                    value: `[View Thread](https://discord.com/channels/${interaction.guildId}/${thread.id}) • <t:${Math.floor(thread.createdTimestamp / 1000)}:R>${verifierInfo}`
                };
            });

            // Wait for all thread information to be processed
            const fields = await Promise.all(threadPromises);
            embed.addFields(fields);

            if (i === 0) { // Add stats to first page
                embed.setFooter({ 
                    text: `Total: ${allThreads.size} | Active: ${activeThreads.threads.size} | Archived: ${allThreads.size - activeThreads.threads.size}` 
                });
            }

            pages.push(embed);
        }

        let currentPage = 0;

        // Create navigation buttons
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pages.length <= 1)
            );

        const response = await interaction.editReply({
            embeds: [pages[0]],
            components: pages.length > 1 ? [buttons] : [],
            ephemeral: true
        });

        if (pages.length <= 1) return;

        // Create button collector
        const collector = response.createMessageComponentCollector({ 
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'You cannot use these buttons.', ephemeral: true });
                return;
            }

            if (i.customId === 'prev') {
                currentPage--;
            } else if (i.customId === 'next') {
                currentPage++;
            }

            // Update button states
            buttons.components[0].setDisabled(currentPage === 0);
            buttons.components[1].setDisabled(currentPage === pages.length - 1);

            await i.update({
                embeds: [pages[currentPage]],
                components: [buttons]
            });
        });

        collector.on('end', () => {
            buttons.components.forEach(button => button.setDisabled(true));
            interaction.editReply({ components: [buttons] }).catch(() => {});
        });
    },
}; 