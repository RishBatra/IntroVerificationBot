const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');

const rainbowColors = [
    '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8B00FF'
];

const pastelRainbowColors = [
    '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#D4BAFF', '#FFBAF2'
];

function getRandomColor(colorScheme) {
    const colors = colorScheme === 'pastel' ? pastelRainbowColors : rainbowColors;
    return colors[Math.floor(Math.random() * colors.length)];
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
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The title of the announcement')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('color_scheme')
                .setDescription('The color scheme to use')
                .setRequired(false)
                .addChoices(
                    { name: 'Rainbow', value: 'rainbow' },
                    { name: 'Pastel', value: 'pastel' },
                    { name: 'Custom', value: 'custom' }
                ))
        .addStringOption(option =>
            option.setName('custom_color')
                .setDescription('Custom color (hex code)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('image_url')
                .setDescription('URL of an image to include')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('mention_role')
                .setDescription('Role to mention in the announcement')
                .setRequired(false))
        .addBooleanOption(option => 
            option.setName('mention_everyone')
                .setDescription('Whether to mention everyone in the announcement')
                .setRequired(false)),
    async execute(interaction) {
        try {
            console.log('Announce command executed');

            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }

            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');
            const title = interaction.options.getString('title') || 'Announcement';
            const colorScheme = interaction.options.getString('color_scheme') || 'rainbow';
            const customColor = interaction.options.getString('custom_color');
            const imageUrl = interaction.options.getString('image_url');
            const mentionRole = interaction.options.getRole('mention_role');
            const mentionEveryone = interaction.options.getBoolean('mention_everyone') || false;

            // Check bot permissions
            if (!channel.permissionsFor(interaction.client.user).has(PermissionsBitField.Flags.SendMessages)) {
                await interaction.reply({ content: 'I don\'t have permission to send messages in the target channel.', ephemeral: true });
                return;
            }

            // Validate message length
            if (message.length > 4000) {
                await interaction.reply({ content: 'The announcement message is too long. Please keep it under 4000 characters.', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(message)
                .setColor(colorScheme === 'custom' && customColor ? customColor : getRandomColor(colorScheme))
                .setTimestamp()
                .setFooter({ text: 'Announcement', iconURL: interaction.guild.iconURL() });

            if (imageUrl) {
                embed.setImage(imageUrl);
            }

            let mentionContent = '';
            if (mentionEveryone) {
                mentionContent = '@everyone';
            } else if (mentionRole) {
                mentionContent = mentionRole.toString();
            }

            await channel.send({ content: mentionContent, embeds: [embed] });

            // Log the announcement
            const logChannel = interaction.guild.channels.cache.find(ch => ch.name === 'announcement-logs');
            if (logChannel) {
                await logChannel.send(`Announcement sent by ${interaction.user.tag} in ${channel.name}`);
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