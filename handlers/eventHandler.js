const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    const eventFiles = fs.readdirSync(path.join(__dirname, '../events')).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const event = require(`../events/${file}`);
        if (event.name && event.execute) {
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        } else {
            console.warn(`The event at ../events/${file} is missing a required "name" or "execute" property.`);
        }
    }
};