const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('memberroles')
        .setDescription('Lists all members with specific roles in alphabetical order'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const roleNames = ['Waiting for Verification', 'Verified', 'Inactive ⏸'];
        const guild = interaction.guild;

        try {
            const roleLists = {};

            for (const roleName of roleNames) {
                const role = guild.roles.cache.find(r => r.name === roleName);
                if (role) {
                    const members = await guild.members.fetch({ role: role.id });
                    roleLists[roleName] = members.map(member => ({
                        username: member.user.username,
                        nickname: member.nickname || member.user.username
                    })).sort((a, b) => a.nickname.localeCompare(b.nickname));
                } else {
                    roleLists[roleName] = [];
                }
            }

            await interaction.editReply('Member lists fetched. Sending results...');

            for (const roleName of roleNames) {
                const members = roleLists[roleName];
                if (members.length === 0) {
                    await interaction.followUp({ content: `No members found with the role "${roleName}".`, ephemeral: true });
                    continue;
                }

                let description = '';
                const messages = [];
                for (const member of members) {
                    const memberString = `${member.nickname} (${member.username})\n`;
                    if (description.length + memberString.length > 4000) {
                        messages.push(description);
                        description = '';
                    }
                    description += memberString;
                }
                if (description) messages.push(description);

                for (let i = 0; i < messages.length; i++) {
                    const embed = new EmbedBuilder()
                        .setTitle(`${roleName} Members (Part ${i + 1}/${messages.length})`)
                        .setDescription(messages[i])
                        .setColor('#00FF00');
                    await interaction.followUp({ embeds: [embed], ephemeral: true });
                }
            }

            await interaction.followUp({ content: 'All member lists have been sent.', ephemeral: true });
        } catch (error) {
            console.error('Error in memberroles command:', error);
            await interaction.followUp({ content: 'There was an error while executing this command. Please try again later.', ephemeral: true });
        }
    },
};