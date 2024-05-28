const { SlashCommandBuilder } = require('discord.js');
const { Collection } = require('discord.js');

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
            if (!interaction || !interaction.member) {
                await interaction.reply('Invalid interaction.');
                return;
            }

            const role = interaction.options.getRole('role');
            const selfiesChannel = interaction.guild.channels.cache.find(channel => channel.name === 'selfies');

            if (!selfiesChannel) {
                await interaction.reply('Selfies channel not found.');
                return;
            }

            await interaction.deferReply(); // Defer the reply to give more time for processing

            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

            let fetchedMessages;
            let lastMessageId;
            const allMessages = [];

            do {
                fetchedMessages = await selfiesChannel.messages.fetch({ limit: 100, before: lastMessageId });
                allMessages.push(...fetchedMessages.values());
                lastMessageId = fetchedMessages.last()?.id;
            } while (fetchedMessages.size === 100);

            const filteredMessages = allMessages.filter(message => 
                message.attachments.size > 0 && 
                message.createdTimestamp >= thirtyDaysAgo &&
                message.member && message.member.roles.cache.has(role.id)
            );

            const usersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.has(role.id));
            const usersWhoPosted = new Collection();

            filteredMessages.forEach(message => {
                usersWhoPosted.set(message.author.id, message.author);
            });

            const usersWhoDidNotPost = usersWithRole.filter(member => !usersWhoPosted.has(member.id));

            if (usersWhoDidNotPost.size === 0) {
                await interaction.editReply('All users with the specified role have posted an image in the selfies channel within the last 30 days.');
            } else {
                const userList = usersWhoDidNotPost.map(member => member.user.tag).join('\n');
                await interaction.editReply(`The following users with the specified role have not posted an image in the selfies channel within the last 30 days:\n${userList}`);
            }
        } catch (error) {
            console.error('Error executing command:', error);
            if (!interaction.replied) {
                await interaction.editReply('An error occurred while executing the command.');
            }
        }
    },
};
