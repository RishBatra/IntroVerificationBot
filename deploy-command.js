const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
require('dotenv').config();

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (command.data) {
        commands.push(command.data.toJSON());
    } else {
        console.error(`Command file ${file} is missing the data property.`);
    }
}

const rest = new REST({ version: '9' }).setToken(process.env.MY_DISCORD_BOT_TOKEN);

rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
)
.then(() => console.log('Successfully registered application commands.'))
.catch(console.error);