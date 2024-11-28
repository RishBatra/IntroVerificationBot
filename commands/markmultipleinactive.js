const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/user'); // Adjust the path as necessary

module.exports = {
    data: new SlashCommandBuilder()
        .setName('markmultipleinactive')
        .setDescription('Mark multiple users as inactive')
        .addStringOption(option => 
            option.setName('users')
                .setDescription('Mention the users to mark as inactive (separate with spaces)')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();

        const usersInput = interaction.options.getString('users');
        const userMentions = usersInput.match(/<@!?(\d+)>/g);

        if (!userMentions) {
            return interaction.editReply('No valid user mentions found.');
        }

        const inactiveRole = interaction.guild.roles.cache.find(role => role.name === 'Inactive ⏸');

        if (!inactiveRole) {
            return interaction.editReply('Inactive role not found.');
        }

        const successfulMarks = [];
        const failedMarks = [];

        for (const mention of userMentions) {
            const userId = mention.replace(/<@!?(\d+)>/, '$1');
            const member = await interaction.guild.members.fetch(userId).catch(() => null);

            if (member) {
                try {
                    const userRoles = member.roles.cache.filter(role => role.id !== inactiveRole.id).map(role => role.id);
                    await User.findOneAndUpdate(
                        { userId: member.id },
                        { userId: member.id, roles: userRoles },
                        { upsert: true }
                    );

                    await member.roles.remove(userRoles);
                    await member.roles.add(inactiveRole);

                    const userEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('You have been marked as inactive')
                        .setDescription('You have been marked as inactive. Raise a talk to mods request if you want to be active again.')
                        .setTimestamp();

                    await member.send({ embeds: [userEmbed] }).catch(() => null);

                    successfulMarks.push(member.user.tag);
                } catch (error) {
                    console.error(`Error marking user ${member.user.tag} as inactive:`, error);
                    failedMarks.push(member.user.tag);
                }
            } else {
                failedMarks.push(`<@${userId}>`);
            }
        }

        const responseEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('Multiple Users Marked as Inactive')
            .setTimestamp();

        if (successfulMarks.length > 0) {
            responseEmbed.addFields({ name: 'Successfully marked as inactive', value: successfulMarks.join('\n') });
        }

        if (failedMarks.length > 0) {
            responseEmbed.addFields({ name: 'Failed to mark as inactive', value: failedMarks.join('\n') });
        }

        return interaction.editReply({ embeds: [responseEmbed] });
    },
};