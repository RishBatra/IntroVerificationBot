const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkverified')
        .setDescription('List members with only the verified role'),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const VERIFIED_ROLE_NAME = 'Verified'; // Replace with the name of your verified role
        const guild = interaction.guild;

        if (!guild) {
            await interaction.editReply('This command can only be used in a server.');
            return;
        }

        const verifiedRole = guild.roles.cache.find(role => role.name === VERIFIED_ROLE_NAME);
        if (!verifiedRole) {
            await interaction.editReply(`Verified role not found.`);
            return;
        }

        const membersWithOnlyVerifiedRole = [];

        try {
            // Fetch members with the Verified role only
            const members = await guild.members.fetch();
            members.forEach(member => {
                if (member.roles.cache.size === 2 && member.roles.cache.has(verifiedRole.id)) {
                    membersWithOnlyVerifiedRole.push(member);
                }
            });
        } catch (error) {
            console.error('Error fetching members:', error);
            await interaction.editReply('An error occurred while fetching members. Please try again later.');
            return;
        }

        if (membersWithOnlyVerifiedRole.length === 0) {
            await interaction.editReply(`No members found with only the "${VERIFIED_ROLE_NAME}" role.`);
            return;
        }

        const PAGE_SIZE = 10;
        let currentPage = 0;

        const generateEmbed = (page) => {
            const start = page * PAGE_SIZE;
            const end = start + PAGE_SIZE;
            const pageMembers = membersWithOnlyVerifiedRole.slice(start, end);

            return new EmbedBuilder()
                .setTitle(`Members with only the "${VERIFIED_ROLE_NAME}" role`)
                .setDescription(pageMembers.map(member => `${member.user.tag} (<@${member.user.id}>)`).join('\n'))
                .setColor('#00FF00')
                .setFooter({ text: `Page ${page + 1} of ${Math.ceil(membersWithOnlyVerifiedRole.length / PAGE_SIZE)}` });
        };

        const generateButtons = (page) => {
            const row = new ActionRowBuilder();
            const totalPages = Math.ceil(membersWithOnlyVerifiedRole.length / PAGE_SIZE);

            if (page > 0) {
                row.addComponents(new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Primary));
            }

            if (page < totalPages - 1) {
                row.addComponents(new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary));
            }

            return row.components.length > 0 ? [row] : [];
        };

        const updateMessage = async () => {
            const embed = generateEmbed(currentPage);
            const components = generateButtons(currentPage);

            await interaction.editReply({
                embeds: [embed],
                components: components
            });
        };

        await updateMessage();

        const collector = interaction.channel.createMessageComponentCollector({ 
            filter: i => i.user.id === interaction.user.id,
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.customId === 'prev') {
                currentPage--;
            } else if (i.customId === 'next') {
                currentPage++;
            }

            await updateMessage();
            await i.deferUpdate();
        });

        collector.on('end', async () => {
            try {
                await interaction.editReply({ components: [] });
            } catch (error) {
                console.error('Error removing buttons:', error);
            }
        });
    },
};