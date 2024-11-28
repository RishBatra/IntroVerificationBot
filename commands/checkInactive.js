const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { differenceInDays, subDays } = require('date-fns');

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
        .addBooleanOption(option =>
            option.setName('include_join_date')
                .setDescription('Include join date in the output')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        console.log('Checkinactive command initiated');

        const inactivityThreshold = interaction.options.getInteger('days');
        const excludeRole = interaction.options.getRole('exclude_role');
        const includeUsernames = interaction.options.getBoolean('include_usernames') ?? false;
        const includeJoinDate = interaction.options.getBoolean('include_join_date') ?? false;
        const guild = interaction.guild;

        try {
            console.log('Fetching guild members');
            await guild.members.fetch();

            const now = new Date();
            const inactiveUsers = [];

            console.log('Processing members');
            for (const [memberId, member] of guild.members.cache) {
                if (member.user.bot) continue;
                if (excludeRole && member.roles.cache.has(excludeRole.id)) continue;

                const lastActivity = await this.getLastActivityTimestamp(guild, member, subDays(now, inactivityThreshold));

                if (!lastActivity || differenceInDays(now, lastActivity) > inactivityThreshold) {
                    inactiveUsers.push({
                        user: member.user,
                        inactiveDays: lastActivity ? differenceInDays(now, lastActivity) : inactivityThreshold,
                        joinedAt: member.joinedAt
                    });
                }
            }

            if (inactiveUsers.length === 0) {
                console.log('No inactive users found');
                await interaction.editReply('No inactive users found.');
                return;
            }

            console.log(`Found ${inactiveUsers.length} inactive users`);
            inactiveUsers.sort((a, b) => b.inactiveDays - a.inactiveDays);

            const formatUser = (u) => {
                let userString = includeUsernames 
                    ? `${u.user.tag} (${u.user.id}) - Inactive for ${u.inactiveDays} days`
                    : `<@${u.user.id}> - Inactive for ${u.inactiveDays} days`;
                if (includeJoinDate) {
                    userString += ` - Joined: ${u.joinedAt.toDateString()}`;
                }
                return userString;
            };

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

            console.log('Checkinactive command completed successfully');
        } catch (error) {
            console.error('Error in checkinactive command:', error);
            await interaction.editReply('An error occurred while checking for inactive users. Please try again later.');
        }
    },

    async getLastActivityTimestamp(guild, member, cutoffDate) {
        let lastActivity = null;

        // Check last message timestamp
        const textChannels = guild.channels.cache.filter(channel => 
            channel.type === 0 && channel.permissionsFor(member).has('ViewChannel')
        );

        for (const [channelId, channel] of textChannels) {
            try {
                const messages = await channel.messages.fetch({ limit: 1, author: member.user });
                if (messages.size > 0) {
                    const messageTimestamp = messages.first().createdAt;
                    if (!lastActivity || messageTimestamp > lastActivity) {
                        lastActivity = messageTimestamp;
                        if (lastActivity > cutoffDate) {
                            return lastActivity; // User is active, no need to check further
                        }
                    }
                }
            } catch (error) {
                console.error(`Error fetching messages for channel ${channelId}:`, error);
            }
        }

        // Check voice state
        if (member.voice.channelId) {
            return new Date(); // User is currently in a voice channel, consider as active
        }

        return lastActivity; 
    }
};       