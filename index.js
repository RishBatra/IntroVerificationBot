const { Client, GatewayIntentBits, Collection, ActivityType, PresenceUpdateStatus, Partials } = require('discord.js');
const { exec } = require('child_process');
require('dotenv').config();
const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');
const mongoose = require('mongoose');
const { checkForReminders } = require('./handlers/introManagementHandler');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Failed to connect to MongoDB', err);
});

// Create the client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.DirectMessages, 
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel] // Required to read DMs
});

// Make client globally available for reminder system
global.client = client;

// Attach the VoiceTextChannelManager to the client
const VoiceTextChannelManager = require('./utils/voiceTextChannelManager'); // Adjust the path accordingly
client.voiceTextManager = new VoiceTextChannelManager(client);

// Run the deploy-commands.js script
exec('node deploy-command.js', (error, stdout, stderr) => {
    if (error) {
        console.error(`Error executing deploy-commands.js: ${error}`);
        return;
    }
    console.log(`deploy-commands.js output: ${stdout}`);
    if (stderr) {
        console.error(`deploy-commands.js stderr: ${stderr}`);
    }

    // Load commands and events after deploying commands
    commandHandler(client);
    eventHandler(client);

    client.once('ready', () => {
        console.log(`Logged in as ${client.user.tag} and ready to go!`);

        // Set the bot's initial status and activity
        client.user.setPresence({
            activities: [{ name: 'a game', type: ActivityType.Playing }],
            status: PresenceUpdateStatus.Online,
        });

        // Example of changing status periodically
        const statuses = [
            { name: 'Hum gay hain hume server ke liye log chaiye', type: ActivityType.Playing },
            // Additional statuses can be added here
        ];

        setInterval(() => {
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            client.user.setActivity(randomStatus.name, { type: randomStatus.type });
        }, 10000); // Change status every 10 seconds

        // Start the reminder system
        setInterval(checkForReminders, 60 * 60 * 1000); // Check every hour
        console.log('Intro reminder system started');
    });

    client.login(process.env.MY_DISCORD_BOT_TOKEN).catch(error => {
        console.error("Error logging in:", error);
    });
});