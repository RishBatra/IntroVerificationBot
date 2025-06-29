const { SlashCommandBuilder, EmbedBuilder, userMention } = require('discord.js');
const Intro = require('../models/intro');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to verify')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('Message ID of the intro being verified (optional)')
                .setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const messageId = interaction.options.getString('message_id');
        const member = interaction.guild.members.cache.get(user.id);
        const executor = interaction.member;

        console.log('User to verify:', user);
        console.log('Member to verify:', member);
        console.log('Executor:', executor);

        // Define the roles
        const adminRole = interaction.guild.roles.cache.find(role => role.name === 'Admins');
        const proudGuardiansRole = interaction.guild.roles.cache.find(role => role.name === 'Proud Guardians');
        const waitingForVerificationRole = interaction.guild.roles.cache.find(role => role.name === 'Waiting for Verification');
        const verifiedRole = interaction.guild.roles.cache.find(role => role.name === 'Verified');
        const generalChannel = interaction.guild.channels.cache.find(channel => channel.name === 'general-chat');

        console.log('Admin Role:', adminRole);
        console.log('Proud Guardians Role:', proudGuardiansRole);
        console.log('Waiting for Verification Role:', waitingForVerificationRole);
        console.log('Verified Role:', verifiedRole);
        console.log('General Channel:', generalChannel);

        // Check if the roles and channels exist
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
        if (!generalChannel) {
            return interaction.reply({ content: 'General channel not found. Please check the channel name.', ephemeral: true });
        }

        // Check if the executor has the required roles
        if (!executor.roles.cache.has(adminRole.id) && !executor.roles.cache.has(proudGuardiansRole.id)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        console.log('Executor has required roles.');

        // Check if the target user has the Waiting for Verification role
        if (!member.roles.cache.has(waitingForVerificationRole.id)) {
            return interaction.reply({ content: 'The user does not have the Waiting for Verification role.', ephemeral: true });
        }

        console.log('Target user has Waiting for Verification role.');

        // Defer the reply to give more time for the operation
        await interaction.deferReply({ ephemeral: true });

        try {
            // If message ID is provided, update the intro status
            if (messageId) {
                const introRecord = await Intro.findOne({ messageId: messageId });
                if (introRecord) {
                    // Check if user has verified role to determine final status
                    const hasVerifiedRole = member.roles.cache.has(verifiedRole.id);
                    
                    if (hasVerifiedRole) {
                        introRecord.status = 'verified';
                        console.log(`User ${user.tag} already has verified role, setting status to 'verified'`);
                    } else {
                        introRecord.status = 'started';
                        console.log(`User ${user.tag} does not have verified role yet, setting status to 'started'`);
                    }
                    
                    await introRecord.save();

                    // Try to remove reactions from the original message since verification is complete
                    try {
                        // Find the intros channel where the message is located
                        const introsChannel = interaction.guild.channels.cache.find(channel => 
                            channel.name === 'intros'
                        );
                        
                        if (introsChannel) {
                            const originalMessage = await introsChannel.messages.fetch(messageId);
                            await originalMessage.reactions.removeAll();
                            console.log(`Removed reactions from intro message ${messageId} - verification complete`);
                        } else {
                            console.log('Intros channel not found');
                        }
                    } catch (error) {
                        console.log('Could not remove reactions from original message:', error.message);
                    }

                    console.log(`Updated intro status for message ${messageId} to: ${introRecord.status}`);
                }
            }

            // Find and close the verification thread if it exists
            const verificationHelpChannel = interaction.guild.channels.cache.find(channel => channel.name === 'verification-help');
            if (verificationHelpChannel) {
                const threads = await verificationHelpChannel.threads.fetchActive();
                const userThread = threads.threads.find(thread => thread.name === `Verification - ${user.tag}`);
                if (userThread) {
                    await userThread.send({
                        embeds: [new EmbedBuilder()
                            .setColor(0x00ff00)
                            .setDescription('✅ Verification completed! This thread will be archived.')
                            .setTimestamp()]
                    });
                    await userThread.setArchived(true);
                }
            }

            // Add the verified role to the target user
            await member.roles.add(verifiedRole);
            console.log('Verified role added.');

            // Remove the Waiting for Verification role from the target user
            await member.roles.remove(waitingForVerificationRole);
            console.log('Waiting for Verification role removed.');

            // Update intro status to verified (with or without message ID)
            let introRecord = null;
            if (messageId) {
                // If message ID was provided, use that
                introRecord = await Intro.findOne({ messageId: messageId });
            } else {
                // If no message ID, find the most recent pending/started intro for this user
                introRecord = await Intro.findOne({ 
                    userId: user.id,
                    status: { $in: ['pending', 'started'] }
                }).sort({ createdAt: -1 }); // Get the most recent one
            }

            if (introRecord) {
                introRecord.status = 'verified';
                await introRecord.save();
                console.log(`Updated intro status to 'verified' for user ${user.tag} (message: ${introRecord.messageId})`);

                // Try to remove reactions from the intro message
                try {
                    const introsChannel = interaction.guild.channels.cache.find(channel => 
                        channel.name === 'intros'
                    );
                    
                    if (introsChannel) {
                        const originalMessage = await introsChannel.messages.fetch(introRecord.messageId);
                        await originalMessage.reactions.removeAll();
                        console.log(`Removed reactions from intro message ${introRecord.messageId} - verification complete`);
                    }
                } catch (error) {
                    console.log(`Could not remove reactions from message ${introRecord.messageId}:`, error.message);
                }
            } else {
                console.log(`No intro record found for user ${user.tag}`);
            }

            // Create a success embed message
            const successEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setDescription(`✅ ${user} was verified by ${interaction.user}.`)
                .setTimestamp();

            // Update the interaction with the success message
            await interaction.editReply({ embeds: [successEmbed] });
            console.log('Success message sent.');

            // Create the welcome message embed
            const rulesChannel = interaction.guild.channels.cache.find(channel => channel.name === 'rules');
            const rolesChannel = interaction.guild.channels.cache.find(channel => channel.name === 'roles');
            const channelGuideChannel = interaction.guild.channels.cache.find(channel => channel.name === 'channel-guide');
            const serverFaqChannel = interaction.guild.channels.cache.find(channel => channel.name === 'server-faq');
            const infoChannel = interaction.guild.channels.cache.find(channel => channel.name === 'info');
            const serverHelpChannel = interaction.guild.channels.cache.find(channel => channel.name === 'server-help');
            const openATicketChannel = interaction.guild.channels.cache.find(channel => channel.name === 'open-a-ticket');
            // const talkToModsUser = userMention('575252669443211264'); // Mention the user by ID

            console.log('Rules Channel:', rulesChannel);
            console.log('Roles Channel:', rolesChannel);
            console.log('Channel Guide Channel:', channelGuideChannel);
            console.log('Server FAQ Channel:', serverFaqChannel);
            console.log('Info Channel:', infoChannel);
            console.log('Server Help Channel:', serverHelpChannel);
            // console.log('Talk to Mods User:', talkToModsUser);
            console.log('Open a Ticket Channel:', openATicketChannel);

            if (!rulesChannel || !rolesChannel || !channelGuideChannel || !serverFaqChannel || !infoChannel || !serverHelpChannel) {
                return interaction.followUp({ content: 'One or more channels for the welcome message were not found. Please check the names.', ephemeral: true });
            }

            const welcomeEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('Welcome!')
                .setDescription(`
                    Hello there! 
                    ${user}
                    Welcome. Don't forget to read <#${rulesChannel.id}> and pick your <#${rolesChannel.id}>. 
                    Go through <#${channelGuideChannel.id}>, <#${serverFaqChannel.id}> & <#${infoChannel.id}> to understand the server structure.
                    
                    For any questions related to server use <#${serverHelpChannel.id}> or <#${openATicketChannel.id}>.
                        `)
                .setTimestamp();

            // Send the welcome message in the general channel
            await generalChannel.send({ embeds: [welcomeEmbed] });
            console.log('Welcome message sent.');
        } catch (error) {
            console.error('Error verifying user:', error);
            if (!interaction.replied) {
                return interaction.editReply({ content: 'There was an error verifying the user.', ephemeral: true });
            }
        }
    },
};