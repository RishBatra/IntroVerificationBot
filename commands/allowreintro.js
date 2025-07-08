const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Intro = require('../models/intro');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allowreintro')
        .setDescription('Restore user access to #intros channel and allow new intro')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to restore intro access for')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for restoring access')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Check permissions
        const executor = interaction.member;
        if (!executor.roles.cache.some(role => role.name === 'Admins' || role.name === 'Proud Guardians')) {
            return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        try {
            // Get the member object
            const member = await interaction.guild.members.fetch(targetUser.id);
            
            // Find the #intros channel
            const introsChannel = interaction.guild.channels.cache.find(channel => channel.name === 'intros');
            
            if (!introsChannel) {
                return interaction.editReply({ content: 'Could not find #intros channel.', ephemeral: true });
            }
            
            // Check if user has permission override
            const existingOverride = introsChannel.permissionOverwrites.cache.get(targetUser.id);
            
            if (!existingOverride) {
                return interaction.editReply({ content: 'This user does not have any intro channel restrictions.', ephemeral: true });
            }
            
            // Remove the permission override (restores default permissions)
            await existingOverride.delete();
            console.log(`[ADMIN OVERRIDE] Removed channel permission override for ${targetUser.tag}`);
            
            // Archive any denied intros in database
            const updateResult = await Intro.updateMany(
                {
                    userId: targetUser.id,
                    guildId: interaction.guildId,
                    status: 'denied'
                },
                { status: 'archived' }
            );
            
            // Log the override
            const logChannel = interaction.guild.channels.cache.find(channel => 
                channel.name === 'intro-reminders'
            );
            
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🔓 INTRO ACCESS RESTORED')
                    .addFields(
                        { name: 'Guardian', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                        { name: 'User', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Action', value: `Restored #intros access, archived ${updateResult.modifiedCount} denied intro(s)`, inline: false }
                    )
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            }
            
            // User will discover restored access when they try to use the channel
            
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Intro Access Restored')
                .setDescription(`${targetUser.tag} can now post in #intros again.`)
                .addFields(
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Database', value: `Archived ${updateResult.modifiedCount} denied intro(s)`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed], ephemeral: true });

        } catch (error) {
            console.error('Error restoring intro access:', error);
            await interaction.editReply({ content: 'An error occurred. Please try again.', ephemeral: true });
        }
    }
}; 