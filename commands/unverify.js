const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Intro = require('../models/intro');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unverify')
        .setDescription('Unverify a user - removes roles and resets to waiting for verification')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to unverify')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for unverifying (optional)')
                .setRequired(false)),
    
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(user.id);
        const executor = interaction.member;

        console.log(`[UNVERIFY] Command initiated by ${executor.user.tag} for user ${user.tag}`);

        // Define the roles
        const adminRole = interaction.guild.roles.cache.find(role => role.name === 'Admins');
        const proudGuardiansRole = interaction.guild.roles.cache.find(role => role.name === 'Proud Guardians');
        const waitingForVerificationRole = interaction.guild.roles.cache.find(role => role.name === 'Waiting for Verification');
        const verifiedRole = interaction.guild.roles.cache.find(role => role.name === 'Verified');

        // Check if the required roles exist
        if (!adminRole) {
            return interaction.reply({ content: 'Admin role not found. Please check the role name.', ephemeral: true });
        }
        if (!proudGuardiansRole) {
            return interaction.reply({ content: 'Proud Guardians role not found. Please check the role name.', ephemeral: true });
        }
        if (!waitingForVerificationRole) {
            return interaction.reply({ content: 'Waiting for Verification role not found. Please check the role name.', ephemeral: true });
        }
        if (!verifiedRole) {
            return interaction.reply({ content: 'Verified role not found. Please check the role name.', ephemeral: true });
        }

        // Check if the executor has the required roles
        if (!executor.roles.cache.has(adminRole.id) && !executor.roles.cache.has(proudGuardiansRole.id)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        console.log('[UNVERIFY] Executor has required roles.');

        // Check if the target user exists
        if (!member) {
            return interaction.reply({ content: 'The user is not a member of this server.', ephemeral: true });
        }

        // Defer the reply to give more time for the operation
        await interaction.deferReply({ ephemeral: true });

        try {
            // Get all user roles except @everyone
            const rolesToRemove = member.roles.cache.filter(role => role.id !== interaction.guild.id);
            const roleNames = rolesToRemove.map(role => role.name).join(', ') || 'None';
            
            console.log(`[UNVERIFY] Removing roles from ${user.tag}: ${roleNames}`);
            
            // Remove all roles
            await member.roles.remove(rolesToRemove);
            console.log(`[UNVERIFY] Removed all roles from ${user.tag}`);

            // Add waiting for verification role back
            await member.roles.add(waitingForVerificationRole);
            console.log(`[UNVERIFY] Added Waiting for Verification role to ${user.tag}`);

            // Reset nickname
            if (member.nickname) {
                try {
                    await member.setNickname(null, `Unverified by ${executor.user.tag}: ${reason}`);
                    console.log(`[UNVERIFY] Reset nickname for ${user.tag}`);
                } catch (nickError) {
                    console.error(`[UNVERIFY] Failed to reset nickname for ${user.tag}:`, nickError);
                }
            }

            // Update intro status in database
            try {
                const introRecords = await Intro.find({ 
                    userId: user.id,
                    status: { $in: ['verified', 'started'] }
                });

                if (introRecords.length > 0) {
                    for (const intro of introRecords) {
                        intro.status = 'archived';
                        await intro.save();
                        console.log(`[UNVERIFY] Archived intro ${intro.messageId} for user ${user.tag}`);
                    }
                }
            } catch (dbError) {
                console.error(`[UNVERIFY] Error updating intro records:`, dbError);
            }

            // Send DM to the user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xff6b6b)
                    .setTitle('⚠️ Verification Status Changed')
                    .setDescription('Your verification status has been reset.')
                    .addFields(
                        { name: '❌ Roles Removed', value: 'All your roles have been removed, including your **Verified** role.' },
                        { name: '🔄 Current Status', value: 'You now have the **Waiting for Verification** role.' },
                        { name: '📝 Reason', value: reason },
                        { name: '🔁 Next Steps', value: 'Please post a new intro in the #intros channel to get verified again.' }
                    )
                    .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
                console.log(`[UNVERIFY] Sent DM to ${user.tag} about verification status change`);
            } catch (dmError) {
                console.error(`[UNVERIFY] Failed to send DM to ${user.tag}:`, dmError);
                
                // If DM fails, tag user in verification-help channel
                const verificationHelpChannelId = '1242333346131087420';
                const verificationHelpChannel = interaction.guild.channels.cache.get(verificationHelpChannelId);
                
                if (verificationHelpChannel) {
                    try {
                        const fallbackEmbed = new EmbedBuilder()
                            .setColor(0xff6b6b)
                            .setTitle('⚠️ Verification Status Changed')
                            .setDescription(`<@${user.id}>, your verification status has been reset.`)
                            .addFields(
                                { name: '❌ Roles Removed', value: 'All your roles have been removed, including your **Verified** role.' },
                                { name: '🔄 Current Status', value: 'You now have the **Waiting for Verification** role.' },
                                { name: '📝 Reason', value: reason },
                                { name: '🔁 Next Steps', value: 'Please post a new intro in <#692965776545546261> to get verified again.' }
                            )
                            .setTimestamp();

                        await verificationHelpChannel.send({ 
                            content: `<@${user.id}>`, 
                            embeds: [fallbackEmbed] 
                        });
                        console.log(`[UNVERIFY] Sent notification to verification-help channel for ${user.tag}`);
                    } catch (channelError) {
                        console.error(`[UNVERIFY] Failed to send message to verification-help channel:`, channelError);
                    }
                }
            }

            // Log the action
            const logChannelId = '1259323620661133342';
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0xff6b6b)
                    .setTitle('User Unverified')
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
                        { name: 'Unverified by', value: `${executor.user.tag}`, inline: true },
                        { name: 'Reason', value: reason },
                        { name: 'Roles Removed', value: roleNames }
                    )
                    .setFooter({ text: `User ID: ${user.id}` })
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
                console.log('[UNVERIFY] Logged unverify action');
            }

            // Create a success embed message
            const successEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setDescription(`✅ ${user} has been unverified and reset to **Waiting for Verification** status.\n**Reason:** ${reason}`)
                .setTimestamp();

            // Update the interaction with the success message
            await interaction.editReply({ embeds: [successEmbed] });
            console.log('[UNVERIFY] Success message sent.');
        } catch (error) {
            console.error('[UNVERIFY] Error unverifying user:', error);
            if (!interaction.replied) {
                return interaction.editReply({ content: 'There was an error unverifying the user.', ephemeral: true });
            }
        }
    },
};

