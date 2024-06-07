const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Send a message to a mentioned channel in an embed format')
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the message to')
                .setRequired(true))
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to mention')
                .setRequired(false)),
    async execute(interaction) {
        const executor = interaction.member;
        const messageContent = interaction.options.getString('message');
        const targetChannel = interaction.options.getChannel('channel');
        const user = interaction.options.getUser('user');

        // Define the roles
        const adminRole = interaction.guild.roles.cache.find(role => role.name === 'Admins');
        const proudGuardiansRole = interaction.guild.roles.cache.find(role => role.name === 'Proud Guardians');

        // Check if the executor has the admin role or proud guardians role
        if (!executor.roles.cache.has(adminRole.id) && !executor.roles.cache.has(proudGuardiansRole.id)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        // Create the embed message
        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setDescription(`${messageContent} ${user ? user.toString() : ''}`)
            .setTimestamp();

        // Send the embed message in the mentioned channel
        await targetChannel.send({ embeds: [embed] });

        // Send success message
        await interaction.reply({ content: `Message sent to ${targetChannel.name}.`, ephemeral: true });
    },
};