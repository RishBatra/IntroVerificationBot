const { EmbedBuilder } = require('discord.js');
const { handleTicket } = require('../handlers/ticketHandler');
const { handleIntro } = require('../handlers/introHandler');
const { handleHoneypot } = require('../handlers/honeypotHandler');
const StickyMessage = require('../models/stickymessage');
const SelfiePost = require('../models/selfiePost');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // console.log(`Received message: "${message.content}" in channel type: ${message.channel.type}`);

        // Ignore bot messages, except for ticket closure notifications
        if (message.author.bot) {
            if (message.content.toLowerCase().includes('ticket closed')) {
                console.log('Ticket closed:', message.content);
            } else {
                // console.log('Ignoring bot message');
            }
            return;
        }

        // Handle messages in guilds (servers)
        if (message.guild) {
            // HONEYPOT CHECK - Must be first to ban immediately
            try {
                const wasHoneypot = await handleHoneypot(message);
                if (wasHoneypot) {
                    // User was banned, stop processing
                    return;
                }
            } catch (error) {
                console.error('Error in honeypot handler:', error);
            }
            // console.log('Message is in a guild');
            
            // Handle intro messages
            if (message.channel.name === 'intros') {
                // console.log('Message is in intros channel, handling introduction');
                try {
                    await handleIntro(message);
                } catch (error) {
                    console.error('Error handling intro:', error);
                }
            }

            // Track selfie posts for Photo Verified members (static images only, no GIFs)
            if (message.channel.name === 'selfies' && message.attachments.size > 0) {
                try {
                    // ONLY static images - NO GIFs (prevents cheating with random GIFs)
                    const hasStaticImage = message.attachments.some(attachment => {
                        const contentType = attachment.contentType?.toLowerCase();
                        return contentType?.startsWith('image/') && 
                               contentType !== 'image/gif';
                    });
                    
                    if (hasStaticImage) {
                        // Check if user has Photo Verified role
                        const photoVerifiedRole = message.guild.roles.cache.get('907912045817634846');
                        
                        if (photoVerifiedRole && message.member.roles.cache.has(photoVerifiedRole.id)) {
                            // Update or create record in database
                            await SelfiePost.findOneAndUpdate(
                                { 
                                    userId: message.author.id,
                                    guildId: message.guild.id
                                },
                                {
                                    userId: message.author.id,
                                    username: message.author.tag,
                                    lastPostDate: new Date(message.createdTimestamp),
                                    channelId: message.channel.id,
                                    messageId: message.id,
                                    guildId: message.guild.id
                                },
                                { 
                                    upsert: true,  // Create if doesn't exist
                                    new: true       // Return updated document
                                }
                            );
                            
                            console.log(`✅ Tracked static selfie by ${message.author.tag}`);
                        }
                    }
                } catch (error) {
                    console.error('Error tracking selfie post:', error);
                }
            }

            // Handle sticky messages
            try {
                const stickyMessage = await StickyMessage.findOne({
                    guildId: message.guild.id,
                    channelId: message.channel.id
                });

                if (stickyMessage && message.id !== stickyMessage.lastMessageId) {
                    // Delete the previous sticky message if it exists
                    if (stickyMessage.lastMessageId) {
                        try {
                            const oldMessage = await message.channel.messages.fetch(stickyMessage.lastMessageId);
                            await oldMessage.delete();
                        } catch (error) {
                            console.error('Error deleting old sticky message:', error);
                        }
                    }

                    // Send the new sticky message
                    const embed = new EmbedBuilder()
                        .setDescription(stickyMessage.message)
                        .setColor(stickyMessage.color);

                    const sentMessage = await message.channel.send({ embeds: [embed] });
                    stickyMessage.lastMessageId = sentMessage.id;
                    await stickyMessage.save();
                }
            } catch (error) {
                console.error('Error handling sticky message:', error);
            }

            // Add any other guild-specific message handling here
        } 
        // Handle direct messages (for ticket system)
        else {
            // console.log('Message is not in a guild, calling handleTicket');
            try {
                await handleTicket(message);
            } catch (error) {
                console.error('Error in handleTicket:', error);
            }
        }

        // Add any global message handling here (applies to both guild and DM messages)
    },
};
