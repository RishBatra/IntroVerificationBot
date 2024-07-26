const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const User = require('../models/user'); // Adjust the path as necessary

module.exports = {
    data: new SlashCommandBuilder()
        .setName('requestaccess')
        .setDescription('Create a request access button in the blackout channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const blackoutChannel = interaction.guild.channels.cache.find(channel => channel.name === 'blackout');
        if (!blackoutChannel) {
            return interaction.editReply('Blackout channel not found.');
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Request Access')
            .setDescription('Click the button below to request access and remove your inactive status.')
            .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }));

        const button = new ButtonBuilder()
            .setCustomId('request_access')
            .setLabel('Request Access')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔓');

        const row = new ActionRowBuilder().addComponents(button);

        const sentMessage = await blackoutChannel.send({ embeds: [embed], components: [row] });
        await sentMessage.pin();
        await interaction.editReply('Request access button has been created and pinned in the blackout channel.');
    },

    async buttonHandler(interaction) {
        if (interaction.customId === 'request_access') {
            await this.handleRequestAccess(interaction);
        } else if (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('reject_')) {
            await this.handleReviewDecision(interaction);
        }
    },

    async modalHandler(interaction) {
        if (interaction.customId === 'access_request_form') {
            await this.handleFormSubmission(interaction);
        }
    },

    async handleRequestAccess(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('access_request_form')
            .setTitle('Access Request Form');

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason_input')
            .setLabel('Reason for being inactive')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const activityInput = new TextInputBuilder()
            .setCustomId('activity_input')
            .setLabel('Are you going to be active?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(reasonInput),
            new ActionRowBuilder().addComponents(activityInput)
        );

        await interaction.showModal(modal);
    },

    async handleFormSubmission(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const reason = interaction.fields.getTextInputValue('reason_input');
        const activity = interaction.fields.getTextInputValue('activity_input');

        const adminChannel = interaction.guild.channels.cache.find(channel => channel.name === 'access-requests');
        if (!adminChannel) {
            return interaction.editReply('Admin channel not found. Please contact an administrator.');
        }

        const reviewEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('Access Request Review')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setDescription(`**Reason:** ${reason}\n**Will be active:** ${activity}`)
            .setTimestamp()
            .setFooter({ text: 'Access Request', iconURL: interaction.client.user.displayAvatarURL() });

        const approveButton = new ButtonBuilder()
            .setCustomId(`approve_${interaction.user.id}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

        const rejectButton = new ButtonBuilder()
            .setCustomId(`reject_${interaction.user.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');

        const row = new ActionRowBuilder().addComponents(approveButton, rejectButton);

        const sentMessage = await adminChannel.send({ embeds: [reviewEmbed], components: [row] });
        
        // Set a timeout to invalidate the request after 24 hours
        setTimeout(async () => {
            try {
                const message = await adminChannel.messages.fetch(sentMessage.id);
                if (message.components.length > 0) {
                    const timeoutEmbed = EmbedBuilder.from(reviewEmbed)
                        .setColor(0xFF0000)
                        .setTitle('Access Request Timed Out')
                        .setDescription(`${reviewEmbed.data.description}\n\n**This request has timed out and is no longer valid.**`);

                    await message.edit({ embeds: [timeoutEmbed], components: [] });
                    
                    await interaction.user.send('Your access request has timed out. Please submit a new request if you still need access.');
                }
            } catch (error) {
                console.error('Error handling request timeout:', error);
            }
        }, 24 * 60 * 60 * 1000); // 24 hours

        await interaction.editReply('Your request has been submitted for review. Please wait for an admin to process it. If not processed within 24 hours, the request will expire.');
    },

    async handleReviewDecision(interaction) {
        await interaction.deferUpdate();

        const [action, userId] = interaction.customId.split('_');
        const member = await interaction.guild.members.fetch(userId);
        const inactiveRole = interaction.guild.roles.cache.find(role => role.name === 'Inactive ⏸');
        const verifiedRole = interaction.guild.roles.cache.find(role => role.name === 'Verified');

        if (!member || !inactiveRole || !verifiedRole) {
            return interaction.editReply({ content: 'Error: Member or roles not found.', components: [] });
        }

        const resultEmbed = new EmbedBuilder()
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp()
            .setFooter({ text: 'Access Request Result', iconURL: interaction.client.user.displayAvatarURL() });

        if (action === 'approve') {
            try {
                const userData = await User.findOne({ userId: userId });
                if (userData) {
                    for (const roleId of userData.roles) {
                        await member.roles.add(roleId).catch(console.error);
                    }
                    await User.deleteOne({ userId: userId });
                } else {
                    await member.roles.add(verifiedRole);
                }

                await member.roles.remove(inactiveRole);

                const generalChannel = interaction.guild.channels.cache.find(channel => channel.name === 'general');
                if (generalChannel) {
                    await generalChannel.send(`Welcome back, ${member}! Don't forget to pick your roles.`);
                }

                resultEmbed
                    .setColor(0x00FF00)
                    .setTitle('Access Granted')
                    .setDescription(`Access has been granted for ${member.user.tag}.`);

                await interaction.editReply({ embeds: [resultEmbed], components: [] });
                await member.send('Your access request has been approved. Welcome back!');
            } catch (error) {
                console.error('Error approving access:', error);
                await interaction.editReply({ content: 'An error occurred while approving access.', components: [] });
            }
        } else if (action === 'reject') {
            resultEmbed
                .setColor(0xFF0000)
                .setTitle('Access Denied')
                .setDescription(`Access has been denied for ${member.user.tag}.`);

            await interaction.editReply({ embeds: [resultEmbed], components: [] });
            await member.send('Your access request has been denied. Please contact an admin for more information.');
        }
    }
};