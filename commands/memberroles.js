const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');

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

            const embeds = roleNames.map(roleName => {
                const members = roleLists[roleName];
                const description = members.length > 0 ? members.map(member => `${member.nickname} (${member.username})`).join('\n') : 'No members found.';
                return new MessageEmbed()
                    .setTitle(`${roleName} Members`)
                    .setDescription(description)
                    .setColor('#00FF00');
            });

            return interaction.reply({ embeds });
        } catch (error) {
            console.error('Error fetching members or roles:', error);
            return interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};