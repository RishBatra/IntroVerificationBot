const { Client, GatewayIntentBits, Collection, ActivityType, PresenceUpdateStatus } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

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
    ],
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

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
        // { name: 'Hum gay hain hume server ke liye log chaiye', type: ActivityType.Playing },
        // { name: 'Server ke loog', type: ActivityType.Watching },
        // { name: 'Hum gay hain hume server ke liye log chaiye', type: ActivityType.Watching },
        // { name: 'LGBTQIndiA zindabad', type: ActivityType.Listening },
    ];

    setInterval(() => {
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        client.user.setActivity(randomStatus.name, { type: randomStatus.type });
    }, 10000); // Change status every 10 seconds
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
    console.error("Error logging in:", error);
});