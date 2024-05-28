const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Send an announcement to a specified channel')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to send the announcement to')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The message to announce')
                .setRequired(true))
        .addBooleanOption(option => 
            option.setName('mention_everyone')
                .setDescription('Whether to mention everyone in the announcement')
                .setRequired(false)),
    async execute(interaction) {
        try {
            console.log('Announce command executed');

            // Check if the user has the MANAGE_MESSAGES permission
            if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');
            const mentionEveryone = interaction.options.getBoolean('do you want to mention everyone?');

            console.log(`Announcement to be sent to channel: ${channel ? channel.name : 'null'}`);
            console.log(`Message: ${message}`);
            console.log(`Mention everyone: ${mentionEveryone}`);

            // Ensure the selected channel is a text-based channel
            if (!channel || channel.type !== ChannelType.GuildText) {
                await interaction.reply({ content: 'Please select a valid text channel.', ephemeral: true });
                return;
            }

            // Create the embed message
            const embed = new EmbedBuilder()
                .setTitle('Announcement')
                .setDescription(message)
                .setColor('#FF0000')
                .setTimestamp()
                .setFooter({ text: `Announcement`, iconURL: interaction.guild.iconURL() });

            // Send the embed message to the specified channel
            if (mentionEveryone) {
                await channel.send({ content: '@everyone', embeds: [embed] });
            } else {
                await channel.send({ embeds: [embed] });
            }

            await interaction.reply({ content: 'Announcement sent successfully!', ephemeral: true });
            console.log('Announcement sent successfully');
        } catch (error) {
            console.error('Error executing announce command:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
            }
        }
    },
};