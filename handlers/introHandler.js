const { ChannelType } = require('discord.js');

function validateIntroMessage(content) {
    const errors = [];
    let isValid = true;

    // Split the content into lines
    const lines = content.split('\n').map(line => line.trim());

    // Define required fields
    const requiredFields = ['Age', 'Gender', 'Pronouns', 'Orientation', 'Location', '*Education/career', 'Hobbies', '*Trivia'];

    // Check each required field
    requiredFields.forEach(field => {
        const lineIndex = lines.findIndex(line => line.startsWith(field + ':'));
        if (lineIndex === -1) {
            errors.push(`Missing ${field} field.`);
            isValid = false;
        } else if (lines[lineIndex].split(':')[1].trim() === '') {
            errors.push(`${field} field cannot be empty.`);
            isValid = false;
        }
    });

    // Check age
    const ageLine = lines.find(line => line.startsWith('Age:'));
    if (ageLine) {
        const age = parseInt(ageLine.split(':')[1].trim());
        if (age < 16 || age > 100) {
            errors.push('Age must be between 16 and 100.');
            isValid = false;
        }
    }

    // Check location
    const locationLine = lines.find(line => line.startsWith('Location:'));
    if (locationLine) {
        const location = locationLine.split(':')[1].trim().toLowerCase();
        if (location === 'india' || location === 'earth') {
            errors.push('Please provide a more specific location in State/City format, e.g., "Maharashtra/Mumbai" or "Delhi/New Delhi".');
            isValid = false;
        }
    }

    // Check orientation
    const orientationLine = lines.find(line => line.startsWith('Orientation:'));
    if (orientationLine) {
        const orientation = orientationLine.split(':')[1].trim().toLowerCase();
        if (orientation === 'bi') {
            errors.push('Please specify your orientation as "Bisexual" or "Bicurious" instead of "bi".');
            isValid = false;
        }
    }

    return { isValid, errors };
}

async function handleIntro(message) {
    const { isValid, errors } = validateIntroMessage(message.content);

    if (!isValid) {
        const errorMessage = `Hey ${message.author}, there were some issues with your introduction:\n\n${errors.join('\n')}`;
        
        // Delete the invalid intro message
        await message.delete();

        // Find the #verification-help channel
        const helpChannel = message.guild.channels.cache.find(channel => 
            channel.name === 'intros-test' && channel.type === ChannelType.GuildText
        );

        if (helpChannel) {
            // Send error message to #verification-help channel
            await helpChannel.send(errorMessage);

            // Optionally, send a DM to the user
            try {
                await message.author.send(`Your introduction in ${message.channel} was invalid. Please check #verification-help for details on how to correct it.`);
            } catch (error) {
                console.error('Failed to send DM to user', error);
            }
        } else {
            console.error('Verification help channel not found');
            await message.author.send(errorMessage);
        }
    } else {
        // Handle valid introductions if needed
        console.log(`Valid introduction from ${message.author.tag}`);
    }
}

module.exports = { handleIntro, validateIntroMessage };