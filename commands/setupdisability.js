const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupdisability')
        .setDescription('Create disability roles and channels automatically')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const guild = interaction.guild;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Ensure bot has required permissions
            const me = guild.members.me;
            const hasManageRoles = me.permissions.has(PermissionFlagsBits.ManageRoles);
            const hasManageChannels = me.permissions.has(PermissionFlagsBits.ManageChannels);
            if (!hasManageRoles || !hasManageChannels) {
                return interaction.editReply('I need both Manage Roles and Manage Channels permissions to run this command.');
            }

            // Warm caches
            await guild.roles.fetch();
            await guild.channels.fetch();

            // --- Create or Reuse Roles ---
            const rolesData = [
                { name: '👁️ Blind / Low Vision', color: 0x1E90FF }, // blue
                { name: '🎧 Deaf / HOH', color: 0x9B59B6 },          // purple
                { name: '🧠 Neurodivergent', color: 0x2ECC71 },      // green
                { name: '♿ Chronic Illness / Mobility', color: 0x95A5A6 }, // grey
                { name: '💜 Mental Health', color: 0xE91E63 },       // pink
                { name: '🌈 Accessibility Ally', color: 0xF1C40F }   // gold
            ];

            const createdRoles = [];
            const reusedRoles = [];
            const roles = {};

            for (const roleData of rolesData) {
                let role = guild.roles.cache.find(r => r.name === roleData.name);
                if (!role) {
                    role = await guild.roles.create({
                        name: roleData.name,
                        color: roleData.color,
                        mentionable: true,
                        reason: 'Setup disability & accessibility roles'
                    });
                    createdRoles.push(role.name);
                } else {
                    reusedRoles.push(role.name);
                }
                roles[roleData.name] = role;
            }

            // --- Create or Reuse Category ---
            const categoryName = '♿ Disability & Accessibility';
            let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === categoryName);

            const baseOverwrites = [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, // @everyone
                ...Object.values(roles).map(r => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel] }))
            ];

            if (!category) {
                category = await guild.channels.create({
                    name: categoryName,
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: baseOverwrites,
                    reason: 'Setup disability & accessibility category'
                });
            } else {
                // Ensure new roles can view the category
                await category.permissionOverwrites.set(baseOverwrites, 'Ensure disability roles can view this category');
            }

            // --- Create or Reuse Channels ---
            const channelsData = [
                {
                    name: 'disability-lounge',
                    topic: 'Casual chat space for members with disability roles.'
                },
                {
                    name: 'accessibility-resources',
                    topic: 'Share helpful tools, guides, and support links.'
                },
                {
                    name: 'accessibility-feedback',
                    topic: 'Suggestions to improve server accessibility.'
                }
            ];

            const createdChannels = [];
            const reusedChannels = [];

            for (const ch of channelsData) {
                let existing = guild.channels.cache.find(c => c.name === ch.name && c.parentId === category.id && c.type === ChannelType.GuildText);
                if (!existing) {
                    existing = await guild.channels.create({
                        name: ch.name,
                        type: ChannelType.GuildText,
                        topic: ch.topic,
                        parent: category.id,
                        reason: 'Setup disability & accessibility channels'
                    });
                    createdChannels.push(existing.name);
                } else {
                    // Update topic if missing
                    if (!existing.topic && ch.topic) {
                        await existing.setTopic(ch.topic, 'Set topic for accessibility channel');
                    }
                    reusedChannels.push(existing.name);
                }
            }

            const summary = [
                `Roles created: ${createdRoles.length ? createdRoles.join(', ') : 'none'}`,
                `Roles reused: ${reusedRoles.length ? reusedRoles.join(', ') : 'none'}`,
                `Channels created: ${createdChannels.length ? createdChannels.join(', ') : 'none'}`,
                `Channels reused: ${reusedChannels.length ? reusedChannels.join(', ') : 'none'}`
            ].join('\n');

            await interaction.editReply(`✅ Disability roles and channels are ready!\n${summary}`);
        } catch (error) {
            console.error('Error in /setupdisability:', error);
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply('❌ There was an error setting up disability roles and channels.');
            }
            return interaction.reply({ content: '❌ There was an error setting up disability roles and channels.', ephemeral: true });
        }
    }
};


