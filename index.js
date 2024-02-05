// Require the discord.js module
const Discord = require('discord.js');

//Setting Intents
const { Client, GatewayIntentBits } = require('discord.js');

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



// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Ready!');
});

// Login to Discord with your app's token
client.login('VA98xILu8_I5i2D1-x5e8myUWpNeeoG6');
