const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { differenceInDays } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkinactive')
        .setDescription('Check for inactive users')
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days to consider for inactivity')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(365))
        .addRoleOption(option =>
            option.setName('exclude_role')
                .setDescription('Role to exclude from inactivity check')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('include_usernames')
                .setDescription('Include usernames in the output')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const inactivityThreshold = interaction.options.getInteger('days');
        const excludeRole = interaction.options.getRole('exclude_role');
        const includeUsernames = interaction.options.getBoolean('include_usernames') ?? false;
        const guild = interaction.guild;

        try {
            await guild.members.fetch();

            const now = new Date();
            const inactiveUsers = [];

            for (const [memberId, member] of guild.members.cache) {
                if (member.user.bot) continue;
                if (excludeRole && member.roles.cache.has(excludeRole.id)) continue;

                const lastActivity = await getLastActivityTimestamp(guild, member);

                if (lastActivity && differenceInDays(now, lastActivity) > inactivityThreshold) {
                    inactiveUsers.push({
                        user: member.user,
                        inactiveDays: differenceInDays(now, lastActivity)
                    });
                }
            }

            if (inactiveUsers.length === 0) {
                await interaction.editReply('No inactive users found.');
                return;
            }

            // Sort inactive users by inactivity duration (most inactive first)
            inactiveUsers.sort((a, b) => b.inactiveDays - a.inactiveDays);

            const formatUser = (u) => includeUsernames 
                ? `${u.user.tag} (${u.user.id}) - Inactive for ${u.inactiveDays} days`
                : `<@${u.user.id}> - Inactive for ${u.inactiveDays} days`;

            const embeds = [];
            for (let i = 0; i < inactiveUsers.length; i += 25) {
                const embed = new EmbedBuilder()
                    .setTitle(i === 0 ? `Inactive Users (${inactivityThreshold}+ days)` : 'Inactive Users (continued)')
                    .setColor('#FF0000')
                    .setDescription(inactiveUsers.slice(i, i + 25).map(formatUser).join('\n'))
                    .setFooter({ text: `Page ${Math.floor(i / 25) + 1}/${Math.ceil(inactiveUsers.length / 25)} | Total: ${inactiveUsers.length}` })
                    .setTimestamp();
                embeds.push(embed);
            }

            await interaction.editReply({ embeds: [embeds[0]] });

            for (let i = 1; i < embeds.length; i++) {
                await interaction.followUp({ embeds: [embeds[i]], ephemeral: true });
            }

        } catch (error) {
            console.error('Error in checkinactive command:', error);
            await interaction.editReply('An error occurred while checking for inactive users. Please try again later.');
        }
    },
};

async function getLastActivityTimestamp(guild, member) {
    let lastActivity = new Date(0);

    // Check last message timestamp
    const textChannels = guild.channels.cache.filter(channel => 
        channel.type === 0 && channel.permissionsFor(member).has('ViewChannel')
    );

    for (const [channelId, channel] of textChannels) {
        try {
            const messages = await channel.messages.fetch({ limit: 1, author: member.user });
            if (messages.size > 0) {
                const messageTimestamp = messages.first().createdAt;
                if (messageTimestamp > lastActivity) {
                    lastActivity = messageTimestamp;
                }
            }
        } catch (error) {
            console.error(`Error fetching messages for channel ${channelId}:`, error);
        }
    }

    // Check voice state
    if (member.voice.channelId) {
        const now = new Date();
        if (now > lastActivity) {
            lastActivity = now;
        }
    }

    return lastActivity.getTime() === 0 ? null : lastActivity;
}