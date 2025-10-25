const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SelfiePost = require('../models/selfiePost');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('migrateselfies')
        .setDescription('One-time migration: Populate database with existing selfie posts from the last 30 days'),
    
    async execute(interaction) {
        try {
            await interaction.deferReply();
            
            const startTime = Date.now();
            const roleId = '907912045817634846';
            const role = interaction.guild.roles.cache.get(roleId);
            
            if (!role) {
                await interaction.editReply('Photo Verified role not found.');
                return;
            }

            const selfiesChannel = interaction.guild.channels.cache.find(ch => ch.name === 'selfies');
            
            if (!selfiesChannel) {
                await interaction.editReply('Selfies channel not found.');
                return;
            }

            await interaction.editReply('🔄 Starting migration... This may take a while. Fetching messages...');
            
            // Fetch last 30 days of messages
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const messages = [];
            let lastId;
            let batchCount = 0;
            
            console.log('Starting to fetch messages for migration...');
            
            while (true) {
                const batch = await selfiesChannel.messages.fetch({ limit: 100, before: lastId });
                batchCount++;
                
                if (batch.size === 0) {
                    console.log('No more messages to fetch');
                    break;
                }
                
                let shouldStop = false;
                for (const msg of batch.values()) {
                    if (msg.createdTimestamp < thirtyDaysAgo) {
                        shouldStop = true;
                        break;
                    }
                    messages.push(msg);
                }
                
                console.log(`Fetched batch ${batchCount}: ${batch.size} messages, total collected: ${messages.length}`);
                
                if (shouldStop) {
                    console.log('Reached 30-day cutoff');
                    break;
                }
                
                lastId = batch.last().id;
                
                // Update progress every 5 batches (500 messages)
                if (batchCount % 5 === 0) {
                    await interaction.editReply(`🔄 Fetching messages... (${messages.length} messages collected so far)`);
                }
                
                // Rate limit protection
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            await interaction.editReply(`📊 Fetched ${messages.length} messages. Now processing...`);
            
            // Process each unique user's most recent post
            const userPosts = new Map();
            
            for (const msg of messages) {
                // Check for static images only (no GIFs)
                const hasStaticImage = msg.attachments.some(attachment => {
                    const contentType = attachment.contentType?.toLowerCase();
                    return contentType?.startsWith('image/') && 
                           contentType !== 'image/gif';
                });
                
                if (hasStaticImage && 
                    msg.member?.roles.cache.has(roleId)) {
                    
                    const existing = userPosts.get(msg.author.id);
                    // Keep only the most recent post per user
                    if (!existing || msg.createdTimestamp > existing.createdTimestamp) {
                        userPosts.set(msg.author.id, msg);
                    }
                }
            }
            
            console.log(`Found ${userPosts.size} unique users with valid selfies`);
            
            // Save to database
            let successCount = 0;
            let errorCount = 0;
            
            for (const [userId, msg] of userPosts) {
                try {
                    await SelfiePost.findOneAndUpdate(
                        { userId, guildId: interaction.guild.id },
                        {
                            userId,
                            username: msg.author.tag,
                            lastPostDate: new Date(msg.createdTimestamp),
                            channelId: msg.channel.id,
                            messageId: msg.id,
                            guildId: interaction.guild.id
                        },
                        { upsert: true }
                    );
                    successCount++;
                } catch (error) {
                    console.error(`Error saving post for user ${userId}:`, error);
                    errorCount++;
                }
            }
            
            const elapsed = Date.now() - startTime;
            
            const resultEmbed = new EmbedBuilder()
                .setTitle('✅ Migration Complete')
                .setDescription(
                    `Successfully migrated selfie posts to database!\n\n` +
                    `**Stats:**\n` +
                    `📨 Messages scanned: ${messages.length}\n` +
                    `👥 Unique users found: ${userPosts.size}\n` +
                    `✅ Successfully saved: ${successCount}\n` +
                    `❌ Errors: ${errorCount}\n` +
                    `⚡ Time taken: ${(elapsed / 1000).toFixed(2)}s`
                )
                .setColor('#00FF00')
                .setTimestamp();
            
            await interaction.editReply({ content: '', embeds: [resultEmbed] });
            console.log(`✅ Migration completed: ${successCount} posts saved in ${elapsed}ms`);
            
        } catch (error) {
            console.error('Error during migration:', error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply('❌ An error occurred during migration. Check console for details.');
            }
        }
    },
};

