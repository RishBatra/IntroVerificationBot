const { EmbedBuilder } = require('discord.js');
const { handleTicket } = require('../handlers/ticketHandler');
const { handleIntro } = require('../handlers/introHandler');
const { handleHoneypot } = require('../handlers/honeypotHandler');
const StickyMessage = require('../models/stickymessage');
const SelfiePost = require('../models/selfiePost');
const UserActivity = require('../models/userActivity');
const { clearSelfieCompliance } = require('../handlers/selfieComplianceHandler');

// Constants for user activity tracking
const ALLOWED_CATEGORY_IDS = [
    "692957855770345485", // text channels
    "693017779158253619"  // topics
];
const MS_PER_DAY = 86400000;

// Configuration for verification help monitor
const VERIFICATION_HELP_CHANNEL_ID = '1242333346131087420';
const INTRO_CHANNEL_ID = '692965776545546261';
const WAITING_FOR_VERIFICATION_ROLE_ID = '692985716040532011';
const MOD_ROLE_ID = '800053595881078784';

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
            // ========================================
            // SECTION 1: VERIFICATION HELP MONITOR
            // ========================================
            // Monitor verification help channel for users needing assistance
            if (message.channel.id === VERIFICATION_HELP_CHANNEL_ID) {
                try {
                    // Check if user has waiting for verification role
                    const hasWaitingRole = message.member.roles.cache.has(WAITING_FOR_VERIFICATION_ROLE_ID);
                    
                    if (hasWaitingRole) {
                        // Check if message mentions #intros or contains "intro"
                        const messageContent = message.content.toLowerCase();
                        const mentionsIntros = message.channelMentions.has(INTRO_CHANNEL_ID) || 
                                              messageContent.includes('intro');
                        
                        if (mentionsIntros) {
                            // Ping mods
                            const modRole = message.guild.roles.cache.get(MOD_ROLE_ID);
                            if (modRole) {
                                await message.channel.send(
                                    `${modRole} - ${message.author} needs help with their intro verification.`
                                );
                            }
                        }
                    }
                } catch (error) {
                    console.error('[VerificationHelpMonitor] Error:', error);
                }
            }

            // ========================================
            // SECTION 2: USER ACTIVITY TRACKER
            // ========================================
            // Track message activity for audit command (only in allowed categories)
            try {
                const channel = message.channel;
                if (channel && !channel.nsfw) {
                    const parentId = channel.parentId ?? channel.parent?.id ?? null;
                    if (parentId && ALLOWED_CATEGORY_IDS.includes(parentId)) {
                        const epochDay = Math.floor((message.createdTimestamp || Date.now()) / MS_PER_DAY);

                        await UserActivity.findOneAndUpdate(
                            { guildId: message.guild.id, userId: message.author.id },
                            {
                                $inc: { [`buckets.${epochDay}`]: 1 },
                                $set: { updatedAt: new Date() }
                            },
                            { upsert: true }
                        );

                        // Opportunistic prune: keep only last 40 days to bound doc size
                        if (Math.random() < 0.02) {
                            const doc = await UserActivity.findOne({ 
                                guildId: message.guild.id, 
                                userId: message.author.id 
                            }).lean();
                            
                            if (doc && doc.buckets) {
                                const cutoff = epochDay - 40;
                                const toUnset = {};
                                for (const key of Object.keys(doc.buckets)) {
                                    const day = Number(key);
                                    if (Number.isFinite(day) && day < cutoff) {
                                        toUnset[`buckets.${key}`] = "";
                                    }
                                }
                                if (Object.keys(toUnset).length > 0) {
                                    await UserActivity.updateOne(
                                        { guildId: message.guild.id, userId: message.author.id },
                                        { $unset: toUnset }
                                    );
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('[UserActivityTracker] Error tracking message activity:', error);
            }

            // ========================================
            // SECTION 3: HONEYPOT CHECK
            // ========================================
            // HONEYPOT CHECK - Must be early to ban immediately
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

                            // Cancel any active grace/revoke window for this user
                            await clearSelfieCompliance(message.guild.id, message.author.id, 'posted_selfie');
                            
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
