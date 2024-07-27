const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channelguide')
        .setDescription('Generate a channel guide for the server'),
    async execute(interaction) {
        await interaction.deferReply();

        const guild = interaction.guild;
        const categories = guild.channels.cache.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
        
        const embed = new EmbedBuilder()
            .setTitle(`${guild.name} Channel Guide`)
            .setColor(0x0099FF)
            .setDescription('Here\'s a guide to our server channels:');

        categories.forEach(category => {
            if (category.name.toLowerCase().includes('nsfw')) return; // Skip NSFW categories

            const channelList = category.children.cache
                .filter(channel => channel.type === 0) // Text channels only
                .sort((a, b) => a.position - b.position)
                .map(channel => {
                    const isOneWay = channel.name.startsWith('📥');
                    return `${channel} ${isOneWay ? '(One-way channel)' : ''}`;
                })
                .join('\n');

            if (channelList.length > 0) {
                embed.addFields({ name: category.name, value: channelList });
            }
        });

        await interaction.editReply({ embeds: [embed] });
    },
};