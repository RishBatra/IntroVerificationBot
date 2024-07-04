const { SlashCommandBuilder, Collection, EmbedBuilder} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkselfies')
        .setDescription('Check if users with a role posted an image in the selfies channel in the last 30 days')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to check')
                .setRequired(true)),
    async execute(interaction) {
        try {
            console.log('Command executed');
            
            if (!interaction || !interaction.member) {
                console.log('Invalid interaction');
                await interaction.reply('Invalid interaction.');
                return;
            }

            const role = interaction.options.getRole('role');
            console.log(`Role selected: ${role.name}`);

            const selfiesChannel = interaction.guild.channels.cache.find(channel => channel.name === 'selfies');
            if (!selfiesChannel) {
                console.log('Selfies channel not found');
                await interaction.reply('Selfies channel not found.');
                return;
            }

            await interaction.deferReply();
            console.log('Reply deferred');

            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
            console.log('Time range calculated');

            let lastMessageId;
            const allMessages = [];
            let fetchingMessages = true;

            console.log('Starting message fetching process...');
            while (fetchingMessages) {
                const fetchedMessages = await selfiesChannel.messages.fetch({ limit: 100, before: lastMessageId });
                console.log(`Fetched ${fetchedMessages.size} messages`);

                if (fetchedMessages.size === 0) {
                    fetchingMessages = false;
                    break;
                }

                allMessages.push(...fetchedMessages.values());
                lastMessageId = fetchedMessages.last()?.id;
                console.log(`Last message ID: ${lastMessageId}`);

                if (fetchedMessages.size < 100) {
                    fetchingMessages = false;
                }
            }

            console.log(`Total messages fetched: ${allMessages.length}`);

            const filteredMessages = allMessages.filter(message => 
                message.attachments.size > 0 && 
                message.createdTimestamp >= thirtyDaysAgo &&
                message.member && message.member.roles.cache.has(role.id)
            );

            console.log(`Messages after filtering: ${filteredMessages.length}`);

            const usersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.has(role.id));
            console.log(`Users with the specified role: ${usersWithRole.size}`);

            const usersWhoPosted = new Collection();

            filteredMessages.forEach(message => {
                usersWhoPosted.set(message.author.id, message.author);
            });

            console.log(`Users who posted: ${usersWhoPosted.size}`);

            const usersWhoDidNotPost = usersWithRole.filter(member => !usersWhoPosted.has(member.id));
            console.log(`Users who did not post: ${usersWhoDidNotPost.size}`);

            if (usersWhoDidNotPost.size === 0) {
                console.log('All users have posted');
                await interaction.editReply('All users with the specified role have posted an image in the selfies channel within the last 30 days.');
            } else {
                const userList = usersWhoDidNotPost.map(member => member.user.tag).join('\n');
                const userMentions = usersWhoDidNotPost.map(member => `<@${member.id}>`).join(', ');
                console.log('Users who did not post:', userList);

                const embed = new EmbedBuilder()
                    .setTitle('Users who have not posted an image')
                    .setDescription(`The following users with the specified role have not posted an image in the selfies channel within the last 30 days:\n${userList}`)
                    .setColor('#FF0000');

                await interaction.editReply({ content: `The following users have not posted an image: ${userMentions}`, embeds: [embed] });
            }

            console.log('Command execution completed');
        } catch (error) {
            console.error('Error executing command:', error);
            if (!interaction.replied) {
                await interaction.editReply('An error occurred while executing the command. Please try again later.');
            }
        }
    },
};