const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkintros')
        .setDescription('Check #intros channel for users who need to post')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

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

            console.log(`[${new Date().toISOString()}] Fetching verified members...`);
            const verifiedMembers = await guild.members.fetch({ cache: false });
            const filteredVerifiedMembers = verifiedMembers.filter(member => member.roles.cache.has(verifiedRole.id));
            console.log(`[${new Date().toISOString()}] Found ${filteredVerifiedMembers.size} verified members`);

            let usersNeedingIntros = [];
            const processedUsers = new Set();

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

                    if (messages.size < 100) {
                        fetchedAllMessages = true;
                    }

                    messages.forEach(message => {
                        processedUsers.add(message.author.id);
                        lastMessageId = message.id;
                    });

                    if (processedUsers.size >= filteredVerifiedMembers.size) {
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

            filteredVerifiedMembers.forEach(member => {
                if (!processedUsers.has(member.id)) {
                    usersNeedingIntros.push(member.user.tag);
                }
            });

            console.log(`[${new Date().toISOString()}] Found ${usersNeedingIntros.length} users needing intros`);

            if (usersNeedingIntros.length === 0) {
                await interaction.editReply('All verified users have posted in #intros.');
            } else {
                const userList = usersNeedingIntros.join('\n');
                await interaction.editReply(`The following users need to post in #intros:\n${userList}`);
            }

            console.log(`[${new Date().toISOString()}] Command 'checkintros' completed successfully`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Unhandled error in 'checkintros' command:`, error);
            await interaction.editReply('An unexpected error occurred. Please try again later or contact the bot administrator.');
        }
    },
};