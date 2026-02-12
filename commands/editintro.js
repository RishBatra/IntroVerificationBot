const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { upsertAndScheduleWindow, sendAdminSpamLog } = require('../utils/introEditAccessService');

const INTRO_CHANNEL_ID = '692965776545546261';
const STAFF_ROLE_NAME = 'Admins';
const WINDOW_MS = 5 * 60 * 1000;

function hasStaffAccess(member) {
    return member.roles.cache.some(role => role.name === STAFF_ROLE_NAME);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editintro')
        .setDescription('Temporarily allow a user to edit/repost intro for 5 minutes')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User who should get temporary intro access')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (!hasStaffAccess(interaction.member)) {
            return interaction.editReply({ content: 'You do not have permission to use this command.' });
        }

        const targetUser = interaction.options.getUser('user');
        if (targetUser.bot) {
            return interaction.editReply({ content: 'This command cannot be used on bots.' });
        }

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

        try {
            await introsChannel.permissionOverwrites.edit(member.id, {
                ViewChannel: true,
                ReadMessageHistory: true,
                SendMessages: true,
                AttachFiles: true,
                EmbedLinks: true
            });
        } catch (error) {
            console.error('[editintro] Failed to create intro overwrite:', error);
            return interaction.editReply({ content: 'Failed to grant temporary intro access.' });
        }

        const expiresAt = new Date(Date.now() + WINDOW_MS);
        const { replaced } = await upsertAndScheduleWindow({
            client: interaction.client,
            guildId: interaction.guild.id,
            userId: targetUser.id,
            expiresAt,
            startedBy: interaction.user.id
        });

        const expiresUnix = Math.floor(expiresAt.getTime() / 1000);

        const responseEmbed = new EmbedBuilder()
            .setColor(0x00bcd4)
            .setTitle('Temporary intro access enabled')
            .setDescription(
                `${targetUser} can now edit/repost in #intros for 5 minutes.\n` +
                `Expires <t:${expiresUnix}:R>.`
            )
            .setFooter({ text: replaced ? 'Existing window was extended.' : 'New window created.' })
            .setTimestamp();

        await interaction.editReply({ embeds: [responseEmbed] });
        await sendAdminSpamLog(
            interaction.client,
            interaction.guild.id,
            `📝 Intro edit access granted to ${targetUser} by ${interaction.user}. Expires <t:${expiresUnix}:R>.`
        );

        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(0x00bcd4)
                .setTitle('You can edit your intro now')
                .setDescription(
                    `Staff gave you temporary access to edit/repost in #intros.\n` +
                    `This access ends <t:${expiresUnix}:R>.`
                )
                .setTimestamp();
            await targetUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            console.log('[editintro] Could not DM user about intro edit window:', dmError.message);
        }
    }
};
