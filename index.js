// Require the discord.js module
const Discord = require('discord.js');

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


// Define acceptable values
const genders = ['Male', 'Female', 'Non-binary', 'Genderqueer', 'Genderfluid', 'Transgender', 'Trans', 'Trans male', 'Trans female', 'Agender', 'Bigender', 'Pangender', 'Questioning']; // Add more as needed
const pronouns = ['He/him', 'She/her', 'They/them', 'Ze/hir', 'Ze/zir', 'Xe/xem']; // Add more as needed
const orientations = ['Homosexual', 'Bisexual', 'Asexual', 'Pansexual', 'Queer', 'bi', 'bi-sexual']; // Add more as needed

client.once('ready', () => {
    console.log('Ready!');
});

client.on('messageCreate', async message => {
    // Ensure message is in the specific channel
    if (message.channel.name === 'intros') {
        // Split message content into lines and then into fields
        const lines = message.content.split('\n').map(line => line.trim());
        let errors = [];

        // Validation functions
        const validateAge = (line) => {
            const age = parseInt(line.split(':')[1].trim(), 10);
            return age >= 0 && age <= 100;
        };

        const validateInList = (line, list) => {
            const value = line.split(':')[1].trim();
            return list.includes(value);
        };

        const validateExists = (line) => line && line.split(':')[1].trim().length > 0;

        // Perform validations
        if (!lines.some(line => line.startsWith('Age:') && validateAge(line))) {
            errors.push('Age must be between 0-100.');
        }

        if (!lines.some(line => line.startsWith('Gender:') && validateInList(line, genders))) {
            errors.push('Gender is not recognized.');
        }

        if (!lines.some(line => line.startsWith('Pronouns:') && validateInList(line, pronouns))) {
            errors.push('Pronouns are not recognized.');
        }

        if (!lines.some(line => line.startsWith('Orientation:') && validateInList(line, orientations))) {
            errors.push('Orientation is not recognized.');
        }

        if (!lines.some(line => line.startsWith('Location:') && validateExists(line))) {
            errors.push('Location is required.');
        }

        // Optional fields like Education/Career, Hobbies, and Trivia don't necessarily need validation for existence but can be validated for format if needed.

        // Send feedback based on validation
        if (errors.length > 0) {
            await message.reply(`Please correct your introduction:\n${errors.join('\n')}`);
        } else {
            // If everything is correct, you might want to send a confirmation or perform further actions
        }
    }
});

// Login to Discord with your app's token
client.login(process.env.DISCORD_BOT_TOKEN);

