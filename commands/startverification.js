const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startverification')
        .setDescription('Open a thread for verification')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to verify')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('target');
        const executor = interaction.member;

        // Check if the executor has Admin or Proud Guardians roles
        const adminRole = 'Admins'; // Replace with your Admin role name or ID
        const proudGuardiansRole = 'Proud Guardians'; // Replace with your Proud Guardians role name or ID

        if (!executor.roles.cache.some(role => role.name === adminRole || role.name === proudGuardiansRole)) {
            return interaction.editReply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        // Check bot permissions in the channel
        const verificationHelpChannel = interaction.guild.channels.cache.find(channel => channel.name === 'verification-help');
        if (!verificationHelpChannel) {
            return interaction.editReply({ content: 'Verification-help channel not found.', ephemeral: true });
        }

        const botPermissions = verificationHelpChannel.permissionsFor(interaction.client.user);
        if (!botPermissions.has(PermissionsBitField.Flags.ManageThreads) || !botPermissions.has(PermissionsBitField.Flags.SendMessagesInThreads) || !botPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.editReply({ content: 'I do not have permission to manage threads or send messages in threads in the verification-help channel.', ephemeral: true });
        }

        // Send message in channel message-list
        const messageListChannel = interaction.guild.channels.cache.find(channel => channel.name === 'message-list');
        if (!messageListChannel) {
            return interaction.editReply({ content: 'Message-list channel not found.', ephemeral: true });
        }

        const executorNick = executor.nickname || executor.user.username;
        const targetNick = targetUser.username; // Discord.js User objects do not have a nickname property

        await messageListChannel.send(`<@${executor.user.id}> (${executorNick}) is messaging <@${targetUser.id}> (${targetNick})`);

        // Create a private thread in verification-help
        try {
            const thread = await verificationHelpChannel.threads.create({
                name: `Verification - ${targetUser.tag}`,
                autoArchiveDuration: 60,
                reason: 'Verification process',
            });

            // Delete the initial system message
            const messages = await verificationHelpChannel.messages.fetch({ limit: 10 });
            const threadCreationMessage = messages.find(msg => msg.system && msg.type === 'THREAD_CREATED');
            if (threadCreationMessage) {
                await threadCreationMessage.delete();
            }

            await thread.members.add(targetUser.id);
            await thread.members.add(executor.id);

            const greetings = [
                `Hello <@${targetUser.id}>, I am <@${executor.user.id}> and I will be helping you with verification today.`,
                `Hi <@${targetUser.id}>, I am <@${executor.user.id}>, here to assist you with your verification.`,
                `Greetings <@${targetUser.id}>, I am <@${executor.user.id}>, and I will guide you through the verification process.`
            ];

            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

            const verificationQuestions = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Verification Questions')
                .setDescription(`${randomGreeting}\n\nPlease answer the following questions:`)
                .addFields(
                    { name: '1.', value: 'Where did you find the server and why do you want to join it?' },
                    { name: '2.', value: 'Are you seeking support or guidance regarding your confusion about your sexuality, or are you looking for a community to connect with?' },
                    { name: '3.', value: 'What are your expectations from our LGBTQIA+ server, and how do you think it can benefit you?' },
                    { name: '4.', value: 'Are you open to learning and respecting the experiences and identities of others within the LGBTQIA+ community?' }
                )
                .setFooter({ text: 'Please refrain from answering in one word or small phrases.' });

            await thread.send({ embeds: [verificationQuestions] });

            await interaction.editReply({ content: `Verification process started for <@${targetUser.id}>.`, ephemeral: true });
        } catch (error) {
            console.error('Error creating thread:', error);
            await interaction.editReply({ content: 'There was an error starting the verification process.', ephemeral: true });
        }
    },
};