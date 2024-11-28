const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('memberroles')
        .setDescription('Lists all members with specific roles in alphabetical order'),

    async execute(interaction) {
        await interaction.deferReply();

        const roleNames = ['Waiting for Verification', 'Verified', 'Inactive ⏸'];
        const guild = interaction.guild;

        // Find the member-list channel
        const memberListChannel = guild.channels.cache.find(channel => channel.name === 'member-list');
        if (!memberListChannel) {
            return await interaction.editReply('Error: Cannot find the "member-list" channel.');
        }

        try {
            await guild.members.fetch();

            for (const roleName of roleNames) {
                const role = guild.roles.cache.find(r => r.name === roleName);
                if (!role) {
                    await memberListChannel.send(`No role found with the name "${roleName}".`);
                    continue;
                }

                const members = role.members
                    .map(member => ({
                        username: member.user.username,
                        nickname: member.nickname || member.user.username
                    }))
                    .sort((a, b) => a.nickname.localeCompare(b.nickname));

                if (members.length === 0) {
                    await memberListChannel.send(`No members found with the role "${roleName}".`);
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
                    await memberListChannel.send({ embeds: [embed] });
                }
            }

            await interaction.editReply('Member lists have been posted in the #member-list channel.');
        } catch (error) {
            console.error('Error in memberroles command:', error);
            await interaction.editReply('There was an error while executing this command. Please try again later.');
        }
    },
};