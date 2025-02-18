const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkverified')
        .setDescription('List members with only the verified role')
        .addBooleanOption(option =>
            option.setName('send_warning')
                .setDescription('Send a warning message in general chat')
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Check if executor has required roles
        const executor = interaction.member;
        const adminRole = 'Admins';
        const proudGuardiansRole = 'Proud Guardians';

        if (!executor.roles.cache.some(role => role.name === adminRole || role.name === proudGuardiansRole)) {
            return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const VERIFIED_ROLE_NAME = 'Verified';
        const guild = interaction.guild;

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

        // Sort members by join date
        membersWithOnlyVerifiedRole.sort((a, b) => a.joinedTimestamp - b.joinedTimestamp);

        // Send warning message if requested
        const sendWarning = interaction.options.getBoolean('send_warning') ?? false;
        if (sendWarning) {
            const generalChannel = interaction.guild.channels.cache.find(channel => channel.name === 'general-chat');
            if (generalChannel) {
                const rolesChannel = interaction.guild.channels.cache.find(channel => channel.name === 'roles');
                const warningEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('⚠️ Role Selection Required')
                    .setDescription(`The following members need to select their roles within 24 hours or they will be marked as inactive:\n
${membersWithOnlyVerifiedRole.map(member => `<@${member.user.id}>`).join('\n')}

Please visit ${rolesChannel ? `<#${rolesChannel.id}>` : 'the roles channel'} to select your roles.`)
                    .setFooter({ text: 'This is an automated message' })
                    .setTimestamp();

                await generalChannel.send({ embeds: [warningEmbed] });
                await interaction.editReply({ content: 'Warning message has been sent to general chat.', ephemeral: true });
            } else {
                await interaction.editReply({ content: 'Could not find general-chat channel to send warning.', ephemeral: true });
                return;
            }
        }

        const PAGE_SIZE = 10;
        let currentPage = 0;

        const generateEmbed = (page) => {
            const start = page * PAGE_SIZE;
            const end = start + PAGE_SIZE;
            const pageMembers = membersWithOnlyVerifiedRole.slice(start, end);

            const embed = new EmbedBuilder()
                .setTitle(`Members with only the "${VERIFIED_ROLE_NAME}" role`)
                .setColor('#00FF00')
                .setDescription(sendWarning ? 
                    'These members have been warned to pick additional roles.' : 
                    'These members have not picked any additional roles yet.')
                .setFooter({ 
                    text: `Page ${page + 1} of ${Math.ceil(membersWithOnlyVerifiedRole.length / PAGE_SIZE)} | Total members: ${membersWithOnlyVerifiedRole.length}` 
                })
                .setTimestamp();

            pageMembers.forEach((member, index) => {
                embed.addFields({
                    name: `${start + index + 1}. ${member.user.tag}`,
                    value: `<@${member.user.id}> • Joined <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
                });
            });

            return embed;
        };

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(membersWithOnlyVerifiedRole.length <= PAGE_SIZE)
            );

        const response = await interaction.editReply({
            embeds: [generateEmbed(0)],
            components: [buttons]
        });

        if (membersWithOnlyVerifiedRole.length <= PAGE_SIZE) return;

        const collector = response.createMessageComponentCollector({ 
            filter: i => i.user.id === interaction.user.id,
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.customId === 'prev') {
                currentPage--;
            } else if (i.customId === 'next') {
                currentPage++;
            }

            // Update button states
            buttons.components[0].setDisabled(currentPage === 0);
            buttons.components[1].setDisabled(currentPage >= Math.ceil(membersWithOnlyVerifiedRole.length / PAGE_SIZE) - 1);

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [buttons]
            });
        });

        collector.on('end', async () => {
            buttons.components.forEach(button => button.setDisabled(true));
            await interaction.editReply({ components: [buttons] }).catch(() => {});
        });
    },
};