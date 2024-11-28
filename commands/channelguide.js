const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channelguide')
        .setDescription('Generate a channel guide for the server'),
    async execute(interaction) {
        console.log('Channelguide command started');
        await interaction.deferReply();
        console.log('Reply deferred');

        const guild = interaction.guild;
        console.log(`Guild ID: ${guild.id}`);
        const categories = guild.channels.cache.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
        console.log(`Number of categories: ${categories.size}`);
        
        const embeds = [];
        let isFirstEmbed = true;

        categories.forEach(category => {
            console.log(`Processing category: ${category.name}`);
            if (category.name.toLowerCase().includes('nsfw')) {
                console.log('NSFW category skipped');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`${category.name}`)
                .setColor(0x0099FF);

            if (isFirstEmbed) {
                embed.setImage('https://media.discordapp.net/attachments/770577556588068865/819814352651550740/unknown.png?ex=66a5e09d&is=66a48f1d&hm=962f3dc84be3a733b1db258297713acb364d5e91840eb41eaea2e27696aa130c&=&format=webp&quality=lossless&width=1000&height=331');
                isFirstEmbed = false;
                console.log('First embed image set');
            }

            const channelDescriptions = category.children.cache
                .filter(channel => channel.type === 0)
                .sort((a, b) => a.position - b.position)
                .map(channel => {
                    console.log(`Processing channel: ${channel.name}`);
                    const isOneWay = channel.name.startsWith('📥');
                    const description = generateChannelDescription(channel.name);
                    return `**${channel.name}**: ${description} ${isOneWay ? '(One-way channel)' : ''}`;
                })
                .join('\n\n');

            if (channelDescriptions.length > 0) {
                embed.setDescription(channelDescriptions);
                embeds.push(embed);
                console.log(`Embed added for category: ${category.name}`);
            } else {
                console.log(`No channels in category: ${category.name}`);
            }
        });

        console.log(`Total number of embeds: ${embeds.length}`);

        let currentPage = 0;

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
            );

        console.log('Button row created');

        const updateMessage = async () => {
            console.log(`Updating message for page: ${currentPage + 1}`);
            const embed = embeds[currentPage];
            embed.setFooter({ text: `Page ${currentPage + 1} of ${embeds.length}` });
            try {
                await interaction.editReply({ embeds: [embed], components: [row] });
                console.log('Message updated successfully');
            } catch (error) {
                console.error('Error updating message:', error);
            }
        };

        try {
            await updateMessage();
            console.log('Initial message sent');
        } catch (error) {
            console.error('Error sending initial message:', error);
            return;
        }

        const collector = interaction.channel.createMessageComponentCollector({ time: 60000 });
        console.log('Collector created');

        collector.on('collect', async i => {
            console.log(`Button clicked: ${i.customId}`);
            if (i.user.id === interaction.user.id) {
                if (i.customId === 'previous') {
                    currentPage = (currentPage - 1 + embeds.length) % embeds.length;
                } else if (i.customId === 'next') {
                    currentPage = (currentPage + 1) % embeds.length;
                }
                await updateMessage();
                await i.deferUpdate();
                console.log('Interaction updated');
            }
        });

        collector.on('end', () => {
            console.log('Collector ended');
            row.components.forEach(button => button.setDisabled(true));
            interaction.editReply({ components: [row] }).catch(console.error);
        });

        console.log('Channelguide command completed');
    },
};

function generateChannelDescription(channelName) {
    console.log(`Generating description for channel: ${channelName}`);
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
    return "Channel for specific discussions or activities.";
}