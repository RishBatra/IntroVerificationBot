const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.guild) return; // Ignore messages from guilds, only handle DMs
        if (message.author.bot) return; // Ignore bot messages

        // Step 2: Ask if they want to open a ticket
        const confirmationMessage = await message.author.send('Do you want to open a ticket to the guild? (yes/no)');

        const filter = response => response.author.id === message.author.id;
        const collected = await confirmationMessage.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });

        const confirmation = collected.first().content.toLowerCase();
        if (confirmation !== 'yes') {
            return message.author.send('Ticket creation cancelled.');
        }

        // Step 3: Ask for the type of ticket
        const ticketTypeMessage = await message.author.send('What type of ticket are you opening? (Report, 18+ (SFW) access, Selfies access, NSFW access, Other)');

        const ticketTypeCollected = await ticketTypeMessage.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
        const ticketType = ticketTypeCollected.first().content;

        // Step 4: Create a new channel in the guild
        const guild = client.guilds.cache.get('692957855770345483'); // Replace with your guild ID
        const category = guild.channels.cache.find(c => c.name === 'Talk to Mods' && c.type === 'GUILD_CATEGORY');
        if (!category) {
            return message.author.send('The "Talk to Mods" category does not exist. Please create it and try again.');
        }

        const ticketChannel = await guild.channels.create({
            name: `${message.author.username}-${ticketType.replace(/[^a-zA-Z0-9]/g, '-')}`,
            type: 'GUILD_TEXT',
            parent: category.id,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: message.author.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                },
                {
                    id: '692958326786359326', // Replace with your moderator role ID
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                },
            ],
        });

        await ticketChannel.send({
            content: `**${message.author.tag} has created a ${ticketType} ticket.**`,
        });

        await message.author.send('Your ticket has been created. Please wait for a moderator to respond.');

        // Step 6: Relay Messages
        client.on('messageCreate', async msg => {
            if (msg.channel.id === ticketChannel.id && msg.author.id !== client.user.id) {
                if (msg.author.bot) return;

                if (msg.member.roles.cache.has('692958326786359326')) { // Replace with your moderator role ID
                    // Assign ticket to the replying moderator
                    await ticketChannel.send(`Ticket assigned to ${msg.author.tag}`);

                    // Message from moderator
                    const userEmbed = new EmbedBuilder()
                        .setColor('#0099FF')
                        .setTitle('Moderator Reply')
                        .setDescription(msg.content)
                        .setFooter({ text: 'Support Team' });

                    await message.author.send({ embeds: [userEmbed] });
                } else {
                    // Message from the user
                    const modEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('User Message')
                        .setDescription(msg.content)
                        .setFooter({ text: `Message from ${message.author.tag}` });

                    await ticketChannel.send({ embeds: [modEmbed] });
                }
            }
        });
    },
};