const { SlashCommandBuilder, Collection, EmbedBuilder} = require('discord.js');
const SelfiePost = require('../models/selfiePost');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkselfies')
        .setDescription('Check if Photo Verified users posted selfies in the last 30 days')
        .addBooleanOption(option => 
            option.setName('send_warning')
                .setDescription('Send a warning message in the channel reminding users to post')
                .setRequired(false)),
    async execute(interaction) {
        try {
            const startTime = Date.now();
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

            // Calculate 30 days ago
            const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
            
            // FAST: Query database instead of scanning messages
            console.log('Querying database for recent selfie posts...');
            const recentPosts = await SelfiePost.find({
                guildId: interaction.guild.id,
                lastPostDate: { $gte: thirtyDaysAgo }
            }).lean();
            
            console.log(`📊 Found ${recentPosts.length} recent posts in database`);
            
            // Create a Set of user IDs who posted
            const usersWhoPosted = new Set(recentPosts.map(post => post.userId));
            
            // Get all members with the Photo Verified role
            console.log('Fetching guild members...');
            await interaction.guild.members.fetch();
            const usersWithRole = role.members;
            console.log(`Users with the specified role: ${usersWithRole.size}`);
            
            // Find who didn't post
            const usersWhoDidNotPost = usersWithRole.filter(
                member => !usersWhoPosted.has(member.id)
            );
            
            const elapsed = Date.now() - startTime;
            console.log(`⚡ Command completed in ${elapsed}ms`);
            console.log(`Users who did not post: ${usersWhoDidNotPost.size}`);

            if (usersWhoDidNotPost.size === 0) {
                console.log('All users have posted');
                await interaction.editReply(`All users with the "${roleName}" role have posted an image in the selfies channel within the last 30 days. ⚡ (${elapsed}ms)`);
            } else {
                const userList = usersWhoDidNotPost.map(member => member.user.tag).join('\n');
                const userMentions = usersWhoDidNotPost.map(member => `<@${member.id}>`).join(', ');
                console.log('Users who did not post:', userList);

                const embed = new EmbedBuilder()
                    .setTitle('Users who have not posted an image')
                    .setDescription(`The following users with the "${roleName}" role have not posted an image in the selfies channel within the last 30 days:\n${userList}`)
                    .setFooter({ text: `Completed in ${elapsed}ms` })
                    .setColor('#FF0000');

                await interaction.editReply({ content: `The following users have not posted an image: ${userMentions}`, embeds: [embed] });
                
                // Send warning message if the option is enabled
                if (sendWarning && usersWhoDidNotPost.size > 0) {
                    const warningEmbed = new EmbedBuilder()
                        .setTitle('Reminder: Post in Selfies Channel')
                        .setDescription(`This is a reminder for members with the "${roleName}" role to post in the selfies channel at least once every 30 days. \n\nThe following members still need to post a selfie in the last 30 days: ${userMentions}`)
                        .setColor('#FFA500');
                    
                    await selfiesChannel.send({ embeds: [warningEmbed] });
                    console.log('Warning message sent to selfies channel');
                }
            }

            console.log('Command execution completed');
        } catch (error) {
            console.error('Error executing command:', error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply('An error occurred while executing the command. Please try again later.');
            } else if (!interaction.replied) {
                await interaction.reply({ content: 'An error occurred while executing the command. Please try again later.', ephemeral: true });
            }
        }
    },
};