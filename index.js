// Require the discord.js module
const Discord = require('discord.js');
// Require the validators module
const { validateIntroMessage } = require('./validators/validateIntro');

//Setting Intents
const { Client, GatewayIntentBits } = require('discord.js');

//Getting env variables
require('dotenv').config();

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.MessageContent, // Be cautious with this intent due to privacy
    // Add any other intents your bot needs
    GatewayIntentBits.Guilds, // For managing roles, channels, and generally necessary
    GatewayIntentBits.GuildMembers, // For managing members, roles, nicknames, etc.
    GatewayIntentBits.GuildModeration, // For listening to ban and unban events
    GatewayIntentBits.GuildMessages, // For sending and receiving messages in guilds
    GatewayIntentBits.GuildMessageReactions, // For adding reactions to messages
    GatewayIntentBits.MessageContent, // To access the content of messages
    GatewayIntentBits.GuildWebhooks, // For managing webhooks
    GatewayIntentBits.GuildInvites, // For managing invites
  ],
});

client.on('messageCreate', async message => {
    if (message.channel.name === 'intros') {
        const { isValid, errors } = validateIntroMessage(message.content);
        
        if (!isValid) {
            await message.reply(`Please correct your introduction:\n${errors.join('\n')}`);
        } else {
            // Handle valid introductions if needed
        }
    }
});

// Login to Discord with your app's token
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag} and ready to go!`);
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
    console.error("Error logging in:", error);
});
