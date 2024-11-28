const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkintros')
        .setDescription('Check #intros channel for users who need to post')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addIntegerOption(option => 
            option.setName('days')
                .setDescription('Number of days to check (default: 30, max: 90)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            console.log(`[${new Date().toISOString()}] Command 'checkintros' initiated by ${interaction.user.tag}`);
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const introsChannel = guild.channels.cache.find(channel => channel.name === 'intros');
            const verifiedRole = guild.roles.cache.find(role => role.name === 'Verified');

            if (!introsChannel || !verifiedRole) {
                console.log(`[${new Date().toISOString()}] Error: Could not find #intros channel or Verified role`);
                return interaction.editReply('Could not find #intros channel or Verified role.');
            }

            const days = Math.min(interaction.options.getInteger('days') || 30, 90);
            const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            console.log(`[${new Date().toISOString()}] Fetching verified members...`);
            const verifiedMembers = await guild.members.fetch({ cache: false });
            const filteredVerifiedMembers = verifiedMembers.filter(member => 
                member.roles.cache.has(verifiedRole.id) && member.joinedAt > cutoffDate);
            console.log(`[${new Date().toISOString()}] Found ${filteredVerifiedMembers.size} verified members who joined in the last ${days} days`);

            const userPostCounts = new Map();

            let lastMessageId = null;
            let fetchedAllMessages = false;
            let totalMessagesFetched = 0;

            console.log(`[${new Date().toISOString()}] Starting to fetch messages from #intros channel`);
            while (!fetchedAllMessages) {
                try {
                    const options = { limit: 100 };
                    if (lastMessageId) {
                        options.before = lastMessageId;
                    }

                    const messages = await introsChannel.messages.fetch(options);
                    totalMessagesFetched += messages.size;

                    if (messages.size < 100 || messages.last().createdAt < cutoffDate) {
                        fetchedAllMessages = true;
                    }

                    messages.forEach(message => {
                        if (message.createdAt >= cutoffDate) {
                            userPostCounts.set(message.author.id, (userPostCounts.get(message.author.id) || 0) + 1);
                        }
                        lastMessageId = message.id;
                    });

                    if (userPostCounts.size >= filteredVerifiedMembers.size) {
                        fetchedAllMessages = true;
                    }

                    console.log(`[${new Date().toISOString()}] Fetched ${totalMessagesFetched} messages so far`);
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Error fetching messages:`, error);
                    await interaction.editReply('An error occurred while fetching messages. Please try again later.');
                    return;
                }
            }

            console.log(`[${new Date().toISOString()}] Finished fetching messages. Total messages processed: ${totalMessagesFetched}`);

            let usersNeedingIntros = [];

            filteredVerifiedMembers.forEach(member => {
                if (!userPostCounts.has(member.id)) {
                    usersNeedingIntros.push(member.user.tag);
                }
            });

            console.log(`[${new Date().toISOString()}] Found ${usersNeedingIntros.length} users needing intros`);

            if (usersNeedingIntros.length === 0) {
                await interaction.editReply(`All verified users who joined in the last ${days} days have posted in #intros.`);
            } else {
                const chunkSize = 1900; // Leave some room for the message header
                const chunks = [];
                let currentChunk = `Users who joined in the last ${days} days needing to post in #intros (Total: ${usersNeedingIntros.length}):\n`;

                for (const user of usersNeedingIntros) {
                    if (currentChunk.length + user.length + 1 > chunkSize) {
                        chunks.push(currentChunk);
                        currentChunk = '';
                    }
                    currentChunk += user + '\n';
                }
                if (currentChunk) chunks.push(currentChunk);

                await interaction.editReply(chunks[0]);
                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp({ content: chunks[i], ephemeral: true });
                }
            }

            console.log(`[${new Date().toISOString()}] Command 'checkintros' completed successfully`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Unhandled error in 'checkintros' command:`, error);
            await interaction.editReply('An unexpected error occurred. Please try again later or contact the bot administrator.');
        }
    },
};