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
        const introsChannelName = 'intros'; // Replace with your #intros channel name
        const targetUser = interaction.options.getUser('target');
        const guild = interaction.guild;

        // Ensure we have the guild and channels loaded
        if (!guild) {
            console.error('Guild not found');
            return interaction.reply('An error occurred: Guild not found.');
        }

        const introsChannel = guild.channels.cache.find(channel => channel.name === introsChannelName && channel.type === 'GUILD_TEXT');

        // Logging for debugging
        console.log(`Looking for channel with name: ${introsChannelName}`);
        if (!introsChannel) {
            console.error('Channel not found');
            console.log(`Available channels: ${guild.channels.cache.map(channel => `${channel.name} (${channel.type})`).join(', ')}`);
            return interaction.reply('The intros channel was not found.');
        }

        console.log(`Found channel: ${introsChannel.name} with type: ${introsChannel.type}`);
        if (introsChannel.type !== 'GUILD_TEXT') {
            console.error('Channel is not a text channel');
            return interaction.reply('The intros channel is not a text channel.');
        }

        try {
            const messages = await introsChannel.messages.fetch({ limit: 100 });
            const userIntro = messages.find(msg => msg.author.id === targetUser.id);

            if (userIntro) {
                const introLink = `https://discord.com/channels/${guild.id}/${introsChannel.id}/${userIntro.id}`;
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