const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');

const rainbowColors = [
    '#FF0000', // Red
    '#FF7F00', // Orange
    '#FFFF00', // Yellow
    '#00FF00', // Green
    '#0000FF', // Blue
    '#4B0082', // Indigo
    '#8B00FF'  // Violet
];

const pastelRainbowColors = [
    '#FFB3BA', // Pastel Red
    '#FFDFBA', // Pastel Orange
    '#FFFFBA', // Pastel Yellow
    '#BAFFC9', // Pastel Green
    '#BAE1FF', // Pastel Blue
    '#D4BAFF', // Pastel Indigo
    '#FFBAF2'  // Pastel Violet
];

function getRandomColor() {
    const combinedColors = [...rainbowColors, ...pastelRainbowColors];
    return combinedColors[Math.floor(Math.random() * combinedColors.length)];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Send an announcement to a specified channel')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to send the announcement to')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText))
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
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');
            const mentionEveryone = interaction.options.getBoolean('mention_everyone') || false;

            console.log(`Announcement to be sent to channel: ${channel ? channel.name : 'null'}`);
            console.log(`Message: ${message}`);
            console.log(`Mention everyone: ${mentionEveryone}`);

            // Create the embed message
            const embed = new EmbedBuilder()
                .setTitle('Announcement')
                .setDescription(message)
                .setColor(getRandomColor())
                .setTimestamp()
                .setFooter({ text: 'Announcement', iconURL: interaction.guild.iconURL() });

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