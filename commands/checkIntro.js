const { SlashCommandBuilder } = require('@discordjs/builders');
const { Permissions } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkuserintro')
        .setDescription('Checks if a user has an intro in the #intros channel')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to check')
                .setRequired(true)
        ),
    async execute(interaction) {
        const introsChannelId = '692965776545546261'; // Replace with your #intros channel ID
        const targetUser = interaction.options.getUser('target');
        const introsChannel = interaction.guild.channels.cache.get(introsChannelId);

        if (!introsChannel || introsChannel.type !== 'GUILD_TEXT') {
            return interaction.reply('The intros channel was not found or is not a text channel.');
        }

        try {
            const messages = await introsChannel.messages.fetch({ limit: 100 });
            const userIntro = messages.find(msg => msg.author.id === targetUser.id);

            if (userIntro) {
                const introLink = `https://discord.com/channels/${interaction.guild.id}/${introsChannel.id}/${userIntro.id}`;
                return interaction.reply(`Intro found: ${introLink}`);
            } else {
                return interaction.reply('No intro found for the specified user.');
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
            return interaction.reply('An error occurred while fetching the intros.');
        }
    },
};