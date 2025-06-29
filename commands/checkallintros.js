const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const Intro = require('../models/intro.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkallintros')
        .setDescription('Check status of all intros in the database')
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Filter by status (optional)')
                .setRequired(false)
                .addChoices(
                    { name: 'All', value: 'all' },
                    { name: 'Pending', value: 'pending' },
                    { name: 'Started', value: 'started' },
                    { name: 'Hold', value: 'hold' },
                    { name: 'Denied', value: 'denied' }
                ))
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of intros to show per page (default: 10, max: 25)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            console.log(`[${new Date().toISOString()}] Command 'checkallintros' initiated by ${interaction.user.tag}`);
            await interaction.deferReply({ ephemeral: true });

            // Check permissions
            const executor = interaction.member;
            const adminRole = 'Admins';
            const proudGuardiansRole = 'Proud Guardians';

            if (!executor.roles.cache.some(role => role.name === adminRole || role.name === proudGuardiansRole)) {
                return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }

            const statusFilter = interaction.options.getString('status') || 'all';
            const limit = Math.min(interaction.options.getInteger('limit') || 10, 25);

            // Build query
            let query = { guildId: interaction.guildId };
            if (statusFilter !== 'all') {
                query.status = statusFilter;
            }

            // Fetch intros from database
            const intros = await Intro.find(query)
                .sort({ createdAt: -1 })
                .limit(1000); // Reasonable limit for pagination

            if (intros.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('No Intros Found')
                    .setDescription(statusFilter === 'all' 
                        ? 'No intros found in the database.' 
                        : `No intros found with status: ${statusFilter}`)
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [embed], ephemeral: true });
            }

            // Filter out duplicates - keep only the most recent intro per user
            const uniqueIntros = [];
            const seenUsers = new Set();
            
            for (const intro of intros) {
                if (!seenUsers.has(intro.userId)) {
                    seenUsers.add(intro.userId);
                    uniqueIntros.push(intro);
                }
            }

            // Get status counts for footer (using unique intros)
            const statusCounts = await Intro.aggregate([
                { $match: { guildId: interaction.guildId } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);

            const statusMap = new Map();
            statusCounts.forEach(item => statusMap.set(item._id, item.count));

            // Split unique intros into pages
            const pages = [];
            for (let i = 0; i < uniqueIntros.length; i += limit) {
                const pageIntros = uniqueIntros.slice(i, i + limit);
                
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Intro Status Report`)
                    .setDescription(`Page ${Math.floor(i / limit) + 1}/${Math.ceil(uniqueIntros.length / limit)}`)
                    .setTimestamp();

                // Process each intro in the page
                const introPromises = pageIntros.map(async (intro) => {
                    try {
                        // Get user info
                        const user = await interaction.client.users.fetch(intro.userId);
                        const userName = user.username;

                        // Check if message still exists
                        let messageExists = true;
                        let channel = null;
                        let message = null;
                        
                        try {
                            channel = await interaction.guild.channels.fetch(intro.channelId);
                            if (channel) {
                                message = await channel.messages.fetch(intro.messageId);
                            }
                        } catch (error) {
                            messageExists = false;
                        }

                        // Get status emoji
                        const statusEmojis = {
                            'pending': '⏳',
                            'started': '🔄',
                            'hold': '⏸️',
                            'denied': '❌'
                        };

                        const statusEmoji = statusEmojis[intro.status] || '❓';
                        
                        // Create message link
                        const messageLink = `https://discord.com/channels/${intro.guildId}/${intro.channelId}/${intro.messageId}`;
                        
                        // For started status, try to find the thread
                        let threadInfo = '';
                        if (intro.status === 'started' && messageExists && message && message.thread) {
                            const threadLink = `https://discord.com/channels/${intro.guildId}/${message.thread.id}`;
                            threadInfo = `\n[View Thread](${threadLink})`;
                        }

                        // Format hold info if applicable
                        let holdInfo = '';
                        if (intro.status === 'hold' && intro.holdUntil) {
                            holdInfo = `\nHold until: <t:${Math.floor(intro.holdUntil.getTime() / 1000)}:R>`;
                        }

                        // Add deleted message indicator
                        const deletedIndicator = !messageExists ? ' 🗑️ (Message Deleted)' : '';

                        return {
                            name: `${statusEmoji} ${userName} (${intro.status})${deletedIndicator}`,
                            value: `[View Message](${messageLink})${threadInfo}${holdInfo}\nCreated: <t:${Math.floor(intro.createdAt.getTime() / 1000)}:R>`
                        };
                    } catch (error) {
                        console.error(`Error processing intro ${intro.messageId}:`, error);
                        return {
                            name: `❓ Unknown User (${intro.status}) 🗑️ (User/Message Deleted)`,
                            value: `[View Message](https://discord.com/channels/${intro.guildId}/${intro.channelId}/${intro.messageId})\nCreated: <t:${Math.floor(intro.createdAt.getTime() / 1000)}:R>`
                        };
                    }
                });

                const fields = await Promise.all(introPromises);
                embed.addFields(fields);

                // Add footer with stats on first page
                if (i === 0) {
                    const totalIntros = uniqueIntros.length;
                    const pendingCount = statusMap.get('pending') || 0;
                    const startedCount = statusMap.get('started') || 0;
                    const holdCount = statusMap.get('hold') || 0;
                    const deniedCount = statusMap.get('denied') || 0;
                    
                    embed.setFooter({ 
                        text: `Showing ${totalIntros} unique users | Pending: ${pendingCount} | Started: ${startedCount} | Hold: ${holdCount} | Denied: ${deniedCount}` 
                    });
                }

                pages.push(embed);
            }

            let currentPage = 0;

            // Create navigation buttons if multiple pages
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

            console.log(`[${new Date().toISOString()}] Command 'checkallintros' completed successfully`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Unhandled error in 'checkallintros' command:`, error);
            await interaction.editReply('An unexpected error occurred. Please try again later or contact the bot administrator.');
        }
    },
}; 