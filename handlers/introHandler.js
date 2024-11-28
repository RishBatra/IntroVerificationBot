const { ChannelType } = require('discord.js');

function validateIntroMessage(content) {
    const errors = [];
    let isValid = true;
    let specialMessage = null;
    const missingFields = [];

    // Split the content into lines
    const lines = content.split('\n').map(line => line.trim());

    // Define required fields
    const requiredFields = ['Age', 'Gender', 'Pronouns', 'Orientation', 'Location', 'Education/career', 'Hobbies', 'Trivia'];

    // Check each required field
    requiredFields.forEach(field => {
        const lineIndex = lines.findIndex(line => 
            line.toLowerCase().startsWith(field.toLowerCase() + ':') ||
            (field === 'Education/career' && line.toLowerCase().startsWith('*education/career:')) ||
            (field === 'Trivia' && line.toLowerCase().startsWith('*trivia:'))
        );
        if (lineIndex === -1) {
            missingFields.push(field);
            isValid = false;
        } else if (lines[lineIndex].split(':')[1].trim() === '') {
            errors.push(`The \`${field}\` field cannot be empty.`);
            isValid = false;
        }
    });

    if (missingFields.length > 0) {
        errors.push(`You are missing the following fields: \`${missingFields.join('`, `')}\``);
    }

    // Check age
    const ageLine = lines.find(line => line.toLowerCase().startsWith('age:'));
    if (ageLine) {
        const age = parseInt(ageLine.split(':')[1].trim());
        if (age < 16) {
            errors.push('You must be at least 16 years old to join this server.');
            specialMessage = `Please join our teen server instead: https://discord.gg/jUdFtEZXJE`;
            isValid = false;
        } else if (age > 100) {
            errors.push('Age must be 100 or below.');
            specialMessage = `Wow, over 100 and using Discord? You must be the coolest great-great-grandparent ever! 😎👴👵`;
            isValid = false;
        }
    }

    // Check location
    const locationLine = lines.find(line => line.toLowerCase().startsWith('location:'));
    if (locationLine) {
        const location = locationLine.split(':')[1].trim().toLowerCase();
        if (location === 'india' || location === 'earth') {
            errors.push('Please provide a more specific location in City/State format, e.g., "Mumbai/Maharashtra" or "New Delhi/Delhi".');
            isValid = false;
        }
    }

    // Check orientation
    const orientationLine = lines.find(line => line.toLowerCase().startsWith('orientation:'));
    if (orientationLine) {
        const orientation = orientationLine.split(':')[1].trim().toLowerCase();
        if (orientation === 'bi') {
            errors.push('Please specify your orientation as "Bisexual" or "Bicurious" instead of "bi".');
            isValid = false;
        }
    }

    return { isValid, errors, specialMessage };
}

async function handleIntro(message) {
    const { isValid, errors, specialMessage } = validateIntroMessage(message.content);

    if (!isValid) {
        let errorMessage = `Hey ${message.author}, I noticed some issues with your introduction:\n\n${errors.join('\n')}`;
        
        if (specialMessage) {
            errorMessage += `\n\n${specialMessage}`;
        }

        // Delete the invalid intro message
        await message.delete();

        // Find the #verification-help channel
        const helpChannel = message.guild.channels.cache.find(channel => 
            channel.name === 'verification-help' && channel.type === ChannelType.GuildText
        );

        // Find the review channel
        const reviewChannel = message.guild.channels.cache.find(channel => 
            channel.name === 'intro-review' && channel.type === ChannelType.GuildText
        );

        if (helpChannel) {
            // Send error message to #verification-help channel
            await helpChannel.send(errorMessage);

            // Send a DM to the user with the error message
            try {
                let dmErrorMessage = errorMessage;
                const ageLine = message.content.split('\n').find(line => line.toLowerCase().startsWith('age:'));
                const age = ageLine ? parseInt(ageLine.split(':')[1].trim()) : null;

                if (age === null || (age >= 16 && age <= 100)) {
                    dmErrorMessage += `\n\nHere's your original message for easy correction:\n\`\`\`\n${message.content}\n\`\`\``;
                }
                await message.author.send(dmErrorMessage);
            } catch (error) {
                console.error('Failed to send DM to user', error);
            }
        } else {
            console.error('Verification help channel not found');
            await message.author.send(errorMessage);
        }

        // Send the deleted intro to the review channel
        if (reviewChannel) {
            await reviewChannel.send(`Deleted intro from ${message.author}:\n\`\`\`\n${message.content}\n\`\`\`\nReason: ${errors.join(', ')}`);
        } else {
            console.error('Review channel not found');
        }
    } else {
        // Handle valid introductions if needed
        console.log(`Valid introduction from ${message.author.tag}`);
    }
}

module.exports = { handleIntro, validateIntroMessage };