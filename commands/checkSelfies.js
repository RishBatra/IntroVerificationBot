const { SlashCommandBuilder, Collection, EmbedBuilder} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkselfies')
        .setDescription('Check if users with the Photo Verified role posted an image in the selfies channel in the last 30 days')
        .addBooleanOption(option => 
            option.setName('send_warning')
                .setDescription('Send a warning message in the channel reminding users to post')
                .setRequired(false)),
    async execute(interaction) {
        try {
            console.log('Command executed');
            
            if (!interaction || !interaction.member) {
                console.log('Invalid interaction');
                await interaction.reply('Invalid interaction.');
                return;
            }

            // Hard-coded role information
            const roleId = '907912045817634846';
            const roleName = 'Photo Verified';
            const role = interaction.guild.roles.cache.get(roleId);
            
            if (!role) {
                console.log(`Role with ID ${roleId} not found`);
                await interaction.reply(`Role "${roleName}" not found.`);
                return;
            }
            
            console.log(`Using role: ${role.name}`);

            const sendWarning = interaction.options.getBoolean('send_warning') || false;
            console.log(`Send warning option: ${sendWarning}`);

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
                await interaction.editReply(`All users with the "${roleName}" role have posted an image in the selfies channel within the last 30 days.`);
            } else {
                const userList = usersWhoDidNotPost.map(member => member.user.tag).join('\n');
                const userMentions = usersWhoDidNotPost.map(member => `<@${member.id}>`).join(', ');
                console.log('Users who did not post:', userList);

                const embed = new EmbedBuilder()
                    .setTitle('Users who have not posted an image')
                    .setDescription(`The following users with the "${roleName}" role have not posted an image in the selfies channel within the last 30 days:\n${userList}`)
                    .setColor('#FF0000');

                await interaction.editReply({ content: `The following users have not posted an image: ${userMentions}`, embeds: [embed] });
                
                // Send warning message if the option is enabled
                if (sendWarning && usersWhoDidNotPost.size > 0) {
                    const warningEmbed = new EmbedBuilder()
                        .setTitle('Reminder: Post in Selfies Channel')
                        .setDescription(`This is a reminder for members with the "${roleName}" role to post in the selfies channel. \n\nThe following members still need to post a selfie in the last 30 days: ${userMentions}`)
                        .setColor('#FFA500');
                    
                    await selfiesChannel.send({ embeds: [warningEmbed] });
                    console.log('Warning message sent to selfies channel');
                }
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