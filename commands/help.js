const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays information about all available commands'),

    async execute(interaction) {
        const commands = interaction.client.commands;
        const commandsPerPage = 10;
        const totalPages = Math.ceil(commands.size / commandsPerPage);
        let currentPage = 0;

        const generateEmbed = (page) => {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Bot Commands')
                .setDescription('Here are all the available commands:')
                .setFooter({ text: `Page ${page + 1} of ${totalPages}` });

            const start = page * commandsPerPage;
            const end = start + commandsPerPage;
            const commandsSlice = Array.from(commands.values()).slice(start, end);

            commandsSlice.forEach(command => {
                embed.addFields({ name: `/${command.data.name}`, value: command.data.description || 'No description available' });
            });

            return embed;
        };

        const generateButtons = (page) => {
            const row = new ActionRowBuilder();

            if (page > 0) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            if (page < totalPages - 1) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            return row;
        };

        const initialEmbed = generateEmbed(currentPage);
        const initialButtons = generateButtons(currentPage);

        const response = await interaction.reply({
            embeds: [initialEmbed],
            components: [initialButtons],
            ephemeral: true
        });

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id === interaction.user.id) {
                if (i.customId === 'prev') {
                    currentPage = Math.max(0, currentPage - 1);
                } else if (i.customId === 'next') {
                    currentPage = Math.min(totalPages - 1, currentPage + 1);
                }

                const newEmbed = generateEmbed(currentPage);
                const newButtons = generateButtons(currentPage);

                await i.update({ embeds: [newEmbed], components: [newButtons] });
            }
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] });
        });
    },
};