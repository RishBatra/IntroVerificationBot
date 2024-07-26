const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const rainbowColors = [
    { name: 'Red', value: '#FF0000' },
    { name: 'Orange', value: '#FF7F00' },
    { name: 'Yellow', value: '#FFFF00' },
    { name: 'Green', value: '#00FF00' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Indigo', value: '#4B0082' },
    { name: 'Violet', value: '#8B00FF' }
];

const pastelRainbowColors = [
    { name: 'Pastel Red', value: '#FFB3BA' },
    { name: 'Pastel Orange', value: '#FFDFBA' },
    { name: 'Pastel Yellow', value: '#FFFFBA' },
    { name: 'Pastel Green', value: '#BAFFC9' },
    { name: 'Pastel Blue', value: '#BAE1FF' },
    { name: 'Pastel Indigo', value: '#D4BAFF' },
    { name: 'Pastel Violet', value: '#FFBAF2' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Send an announcement to a specified channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to send the announcement to')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The message to announce (use \\n for new lines)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The title of the announcement')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('color')
            .setDescription('Choose a color or enter a custom hex code')
            .setRequired(false)
            .addChoices(
                ...rainbowColors.map(c => ({ name: c.name, value: c.value })),
                ...pastelRainbowColors.map(c => ({ name: c.name, value: c.value })),
                { name: 'Custom', value: 'custom' }
            ))
        .addStringOption(option =>
            option.setName('custom_color')
                .setDescription('Custom color hex code (if Custom color is selected)')
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
            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message').replace(/\\n/g, '\n');
            const title = interaction.options.getString('title') || 'Announcement';
            const colorChoice = interaction.options.getString('color');
            const imageUrl = interaction.options.getString('image_url');
            const mentionRole = interaction.options.getRole('mention_role');
            const mentionEveryone = interaction.options.getBoolean('mention_everyone') || false;

            if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
                return await interaction.reply({ content: 'Please select a text or announcement channel.', ephemeral: true });
            }

            if (!channel.permissionsFor(interaction.client.user).has(PermissionFlagsBits.SendMessages)) {
                return await interaction.reply({ content: 'I don\'t have permission to send messages in the target channel.', ephemeral: true });
            }

            if (message.length > 4000) {
                return await interaction.reply({ content: 'The announcement message is too long. Please keep it under 4000 characters.', ephemeral: true });
            }

            let embedColor = '#000000'; // Default color
            if (colorChoice) {
                if (colorChoice === 'custom') {
                    embedColor = interaction.options.getString('custom_color') || '#000000';
                } else {
                    embedColor = colorChoice;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(message)
                .setColor(embedColor)
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

            const logChannel = interaction.guild.channels.cache.find(ch => ch.name === 'announcement-logs');
            if (logChannel) {
                await logChannel.send(`Announcement sent by ${interaction.user.tag} in ${channel.name}`);
            }

            await interaction.reply({ content: 'Announcement sent successfully!', ephemeral: true });
        } catch (error) {
            console.error('Error executing announce command:', error);
            await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
        }
    },
};