const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    client.commands = new Collection();
    const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`../commands/${file}`);
        client.commands.set(command.data.name, command);
    }
};