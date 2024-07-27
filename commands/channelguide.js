const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channelguide')
        .setDescription('Generate a channel guide for the server'),
    async execute(interaction) {
        await interaction.deferReply();

        const guild = interaction.guild;
        const categories = guild.channels.cache.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
        
        const embeds = [];
        let isFirstEmbed = true;

        categories.forEach(category => {
            if (category.name.toLowerCase().includes('nsfw')) return; // Skip NSFW categories

            const embed = new EmbedBuilder()
                .setTitle(`${category.name}`)
                .setColor(0x0099FF);

            if (isFirstEmbed) {
                embed.setImage('https://media.discordapp.net/attachments/770577556588068865/819814352651550740/unknown.png?ex=66a5e09d&is=66a48f1d&hm=962f3dc84be3a733b1db258297713acb364d5e91840eb41eaea2e27696aa130c&=&format=webp&quality=lossless&width=1000&height=331');
                isFirstEmbed = false;
            }

            const channelDescriptions = category.children.cache
                .filter(channel => channel.type === 0) // Text channels only
                .sort((a, b) => a.position - b.position)
                .map(channel => {
                    const isOneWay = channel.name.startsWith('📥');
                    const description = generateChannelDescription(channel.name);
                    return `**${channel.name}**: ${description} ${isOneWay ? '(One-way channel)' : ''}`;
                })
                .join('\n\n');

            if (channelDescriptions.length > 0) {
                embed.setDescription(channelDescriptions);
                embeds.push(embed);
            }
        });

        await interaction.editReply({ embeds: embeds });
    },
};

function generateChannelDescription(channelName) {
    // This function generates a description based on the channel name
    // You can expand this with more detailed descriptions
    const lowercaseName = channelName.toLowerCase();
    if (lowercaseName.includes('general')) {
        return "General discussion channel for all topics.";
    } else if (lowercaseName.includes('rules')) {
        return "Contains the server rules. Must-read for all members.";
    } else if (lowercaseName.includes('intro')) {
        return "Introduce yourself to the community here.";
    } else if (lowercaseName.includes('announcement')) {
        return "Important server updates and announcements.";
    } else if (lowercaseName.includes('bot')) {
        return "Channel for using bot commands.";
    } else if (lowercaseName.includes('suggestion')) {
        return "Share your ideas to improve the server.";
    }
    // Add more conditions for other channel types
    return "Channel for specific discussions or activities.";
}