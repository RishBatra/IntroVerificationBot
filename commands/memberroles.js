const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('memberroles')
        .setDescription('Lists all members with specific roles in alphabetical order'),

    async execute(interaction) {
        const roleNames = ['Waiting for Verification', 'Verified', 'Inactive ⏸'];
        const guild = interaction.guild;

        try {
            await guild.members.fetch(); // Fetch all members

            const roleLists = {};

            for (const roleName of roleNames) {
                const role = guild.roles.cache.find(r => r.name === roleName);
                if (role) {
                    const members = guild.members.cache
                        .filter(member => member.roles.cache.has(role.id))
                        .map(member => ({
                            username: member.user.username,
                            nickname: member.nickname || member.user.username
                        }))
                        .sort((a, b) => a.nickname.localeCompare(b.nickname));
                    roleLists[roleName] = members;
                } else {
                    roleLists[roleName] = [];
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to prevent rate limits
            }

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
                    if (description.length + memberString.length > 4096) {
                        messages.push(description);
                        description = '';
                    }
                    description += memberString;
                }
                messages.push(description);

                for (const message of messages) {
                    const embed = new EmbedBuilder()
                        .setTitle(`${roleName} Members`)
                        .setDescription(message)
                        .setColor('#00FF00');
                    await interaction.followUp({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error('Error fetching members or roles:', error);
            return interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};