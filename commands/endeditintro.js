const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const IntroEditWindow = require('../models/introEditWindow');
const { endWindowAndPersist, sendAdminSpamLog } = require('../utils/introEditAccessService');

const INTRO_CHANNEL_ID = '692965776545546261';
const STAFF_ROLE_NAME = 'Admins';

function hasStaffAccess(member) {
    return member.roles.cache.some(role => role.name === STAFF_ROLE_NAME);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('endeditintro')
        .setDescription('End temporary intro edit access immediately')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User whose intro access should end')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (!hasStaffAccess(interaction.member)) {
            return interaction.editReply({ content: 'You do not have permission to use this command.' });
        }

        const targetUser = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.editReply({ content: 'User not found in this server.' });
        }

        const introsChannel = interaction.guild.channels.cache.get(INTRO_CHANNEL_ID) ||
            interaction.guild.channels.cache.find(channel => channel.name === 'intros');

        if (!introsChannel) {
            return interaction.editReply({ content: 'Intros channel not found.' });
        }

        const botMember = interaction.guild.members.me;
        const botPerms = introsChannel.permissionsFor(botMember);
        if (!botPerms || !botPerms.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.editReply({ content: 'I need Manage Channels permission in #intros to do this.' });
        }

        const activeWindow = await IntroEditWindow.findOne({
            guildId: interaction.guild.id,
            userId: targetUser.id,
            status: 'active'
        });
        const hadWindow = Boolean(activeWindow);

        await endWindowAndPersist({
            client: interaction.client,
            guildId: interaction.guild.id,
            userId: targetUser.id,
            endedBy: interaction.user.id
        });

        const embed = new EmbedBuilder()
            .setColor(0x22c55e)
            .setTitle('Temporary intro access removed')
            .setDescription(
                hadWindow
                    ? `${targetUser}'s temporary intro edit window has been ended.`
                    : `${targetUser} did not have an active timer, but any intro channel overwrite has been removed.`
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        await sendAdminSpamLog(
            interaction.client,
            interaction.guild.id,
            `📝 Intro edit access force-ended for ${targetUser} by ${interaction.user}.`
        );

    }
};
