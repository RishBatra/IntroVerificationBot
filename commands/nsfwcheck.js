const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nsfwcheck')
        .setDescription('Check if a user is eligible for NSFW access')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check for NSFW access')
                .setRequired(true)),
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const executor = interaction.member;
            const user = interaction.options.getUser('user');
            const member = interaction.guild.members.cache.get(user.id);

            // Define the roles
            const adminRole = interaction.guild.roles.cache.find(role => role.name === 'Admins');
            const greenCircleRole = interaction.guild.roles.cache.find(role => role.name === '🟢');
            const starRole = interaction.guild.roles.cache.find(role => role.name === '⭐');
            const lewdBoisRole = interaction.guild.roles.cache.find(role => role.name === 'lewd bois');
            const lewdGalsRole = interaction.guild.roles.cache.find(role => role.name === 'lewd gals');
            const lewdFolksRole = interaction.guild.roles.cache.find(role => role.name === 'lewd folks');
            const introChannel = interaction.guild.channels.cache.find(channel => channel.name === 'intros');
            const pronounRoles = {
                'He/Him': 'He/Him',
                'She/Her': 'She/Her',
                'They/Them': 'They/Them',
                'Ask for Pronouns': 'Ask for Pronouns'
            };

            // Check if the executor has the admin role
            if (!executor.roles.cache.has(adminRole.id)) {
                return interaction.editReply({ content: 'You do not have permission to use this command.' });
            }

            // Check if the user has both the green circle emoji role and star emoji role
            if (!member.roles.cache.has(greenCircleRole.id) || !member.roles.cache.has(starRole.id)) {
                return interaction.editReply({ content: 'The user does not have the required roles.' });
            }

            // Recursive function to fetch all messages from the intro channel until we find the user's intro
            async function fetchMessagesBefore(lastMessageId) {
                const options = { limit: 100 };
                if (lastMessageId) {
                    options.before = lastMessageId;
                }

                try {
                    const messages = await introChannel.messages.fetch(options);
                    const introMessage = messages.find(msg => msg.author.id === user.id && msg.content.includes('Age:'));

                    if (introMessage) {
                        return introMessage;
                    } else if (messages.size < 100) {
                        return null; // No more messages to fetch
                    } else {
                        return fetchMessagesBefore(messages.last().id);
                    }
                } catch (error) {
                    console.error('Error fetching messages:', error);
                    return null;
                }
            }

            const introMessage = await fetchMessagesBefore();

            if (!introMessage) {
                return interaction.editReply({ content: 'The user does not have an intro message with age information.' });
            }

            const ageMatch = introMessage.content.match(/Age:\s*(\d+)/);
            if (!ageMatch || parseInt(ageMatch[1]) < 18) {
                return interaction.editReply({ content: 'The user is not 18+.' });
            }

            // Check if the user's join date is more than one month on the server
            const joinDate = member.joinedAt;
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            if (joinDate > oneMonthAgo) {
                return interaction.editReply({ content: 'The user has not been on the server for more than one month.' });
            }

            // Check the user's pronouns based on their roles
            const userPronouns = Object.keys(pronounRoles).find(pronoun => member.roles.cache.some(role => role.name === pronoun));
            if (!userPronouns) {
                return interaction.editReply({ content: 'The user does not have a pronoun role.' });
            }

            // Suggest default roles based on pronouns and wait for admin response
            const defaultRole = userPronouns === 'He/Him' ? lewdBoisRole :
                                userPronouns === 'She/Her' ? lewdGalsRole :
                                userPronouns === 'They/Them' ? lewdFolksRole : null;

            const roleOptions = [
                { label: 'lewd bois', value: lewdBoisRole.id },
                { label: 'lewd gals', value: lewdGalsRole.id },
                { label: 'lewd folks', value: lewdFolksRole.id }
            ];

            const roleSelectMenu = new StringSelectMenuBuilder()
                .setCustomId('select-role')
                .setPlaceholder('Select a role')
                .addOptions(roleOptions);

            const row = new ActionRowBuilder().addComponents(roleSelectMenu);

            await interaction.editReply({ content: `The user is eligible for NSFW access. Suggested role: ${defaultRole.name}. Please select a role:`, components: [row] });

            const filter = i => i.customId === 'select-role' && i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async i => {
                try {
                    const selectedRoleId = i.values[0];
                    const selectedRole = interaction.guild.roles.cache.get(selectedRoleId);

                    await member.roles.add(selectedRole);

                    // Send success messages
                    const successEmbed = new EmbedBuilder()
                        .setColor(0x00ff00)
                        .setDescription(`✅ ${user} has been given the ${selectedRole.name} role by ${interaction.user}.`)
                        .setTimestamp();

                    await interaction.followUp({ embeds: [successEmbed], ephemeral: true });

                    await user.send(`You have been given the ${selectedRole.name} role in ${interaction.guild.name}.`);

                    collector.stop();
                } catch (error) {
                    console.error('Error assigning role:', error);
                    await interaction.followUp({ content: 'There was an error assigning the role. Please try again later.', ephemeral: true });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.followUp({ content: 'No role was selected. The process has been cancelled.', ephemeral: true });
                }
            });
        } catch (error) {
            console.error('Error executing command:', error);
            await interaction.editReply({ content: 'There was an error executing the command. Please try again later.' });
        }
    },
};