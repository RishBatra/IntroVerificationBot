const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parse, format, addDays, isValid, setHours, setMinutes } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createevent')
        .setDescription('Creates a scheduled event')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the event')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('The description of the event')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel for the event (or enter location name)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('date')
                .setDescription('The start date of the event (DD:MM:YY, DD/MM/YY, today, tomorrow, this <day of week>, or "17 June")')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('enddate')
                .setDescription('The end date of the event (DD:MM:YY, DD/MM/YY, today, tomorrow, this <day of week>, or "17 June")')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('starttime')
                .setDescription('The start time of the event (HH:MM, HHMM, HH:MMAM/PM, HHMMAM/PM, or HHAM/PM)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('endtime')
                .setDescription('The end time of the event (HH:MM, HHMM, HH:MMAM/PM, HHMMAM/PM, or HHAM/PM)')
                .setRequired(true)),
    async execute(interaction) {
        const requiredRoles = new Set(['Admins', 'Contributors', 'Proud Guardians']);
        const memberRoles = new Set(interaction.member.roles.cache.map(role => role.name));
        const roleToMention = '861562283921244161'; // Replace with the actual role ID
        const notificationChannelId = '863436760234065971'; // Replace with the actual channel ID

        if (![...requiredRoles].some(role => memberRoles.has(role))) {
            return interaction.reply({ content: 'You do not have the required roles to use this command.', ephemeral: true });
        }

        const name = interaction.options.getString('name');
        const description = interaction.options.getString('description');
        const channelOption = interaction.options.getChannel('channel');
        let date = interaction.options.getString('date').toLowerCase();
        let endDate = interaction.options.getString('enddate');
        let startTime = interaction.options.getString('starttime');
        let endTime = interaction.options.getString('endtime');

        const channel = channelOption ? channelOption.id : null;
        const location = channelOption ? null : interaction.options.getString('channel');

        console.log(`Date: ${date}, End Date: ${endDate}, Start Time: ${startTime}, End Time: ${endTime}`);

        // Function to parse natural language dates and dates like "17 June"
        const parseNaturalDate = (input) => {
            const today = new Date();
            let targetDate;

            if (input === 'today') {
                targetDate = today;
            } else if (input === 'tomorrow') {
                targetDate = addDays(today, 1);
            } else if (input.startsWith('this ')) {
                const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const targetDay = daysOfWeek.indexOf(input.split(' ')[1]);
                if (targetDay === -1) {
                    return null;
                }
                targetDate = addDays(today, (targetDay + 7 - today.getDay()) % 7);
            } else if (input.match(/^\d{1,2} \w+$/)) {
                const [day, month] = input.split(' ');
                targetDate = new Date(`${day} ${month} ${today.getFullYear()}`);
            } else {
                const dateParts = input.split(/[:/]/);
                if (dateParts.length !== 3) {
                    return null;
                }
                let [day, month, year] = dateParts;
                if (year.length === 2) {
                    year = `20${year}`;
                }
                targetDate = new Date(year, month - 1, day);
            }
            return targetDate;
        };

        // Parse start date
        const parsedDate = parseNaturalDate(date);
        if (!isValid(parsedDate)) {
            return interaction.reply({ content: 'Invalid start date format. Please use DD:MM:YY, DD/MM/YY, today, tomorrow, this <day of week>, or "17 June".', ephemeral: true });
        }

        // Parse end date
        const parsedEndDate = endDate ? parseNaturalDate(endDate) : parsedDate;
        if (!isValid(parsedEndDate)) {
            return interaction.reply({ content: 'Invalid end date format. Please use DD:MM:YY, DD/MM/YY, today, tomorrow, this <day of week>, or "17 June".', ephemeral: true });
        }

        // Handle time format
        const formatTime = (time) => {
            const meridiemMatch = time.match(/(am|pm)$/i);
            let hours, minutes = '00';
            if (meridiemMatch) {
                const meridiem = meridiemMatch[1].toLowerCase();
                time = time.slice(0, -2);
                if (time.includes(':')) {
                    [hours, minutes] = time.split(':');
                } else if (time.length === 4) {
                    hours = time.slice(0, 2);
                    minutes = time.slice(2);
                } else {
                    hours = time;
                }
                hours = parseInt(hours, 10);
                minutes = parseInt(minutes, 10);
                if (meridiem === 'pm' && hours !== 12) {
                    hours += 12;
                } else if (meridiem === 'am' && hours === 12) {
                    hours = 0;
                }
            } else {
                if (time.includes(':')) {
                    [hours, minutes] = time.split(':');
                } else if (time.length === 4) {
                    hours = time.slice(0, 2);
                    minutes = time.slice(2);
                } else {
                    hours = time;
                }
                hours = parseInt(hours, 10);
                minutes = parseInt(minutes, 10);
            }
            if (hours < 10) hours = `0${hours}`;
            if (minutes < 10) minutes = `0${minutes}`;
            return `${hours}:${minutes}`;
        };

        startTime = formatTime(startTime);
        endTime = formatTime(endTime);
        if (!startTime || !endTime) {
            return interaction.reply({ content: 'Invalid time format. Please use HH:MM, HHMM, HH:MMAM/PM, HHMMAM/PM, or HHAM/PM.', ephemeral: true });
        }

        // Handle endTime being "24:00"
        if (endTime === "24:00") {
            endTime = "00:00";
            parsedEndDate = addDays(parsedEndDate, 1);
        }

        // Combine date and time
        const combineDateTime = (date, time) => {
            const [hours, minutes] = time.split(':');
            const result = new Date(date);
            result.setHours(hours, minutes, 0, 0);
            return result;
        };

        const startDateTimeIST = combineDateTime(parsedDate, startTime);
        const endDateTimeIST = combineDateTime(parsedEndDate, endTime);
        console.log(`Start DateTime IST: ${startDateTimeIST}`);
        console.log(`End DateTime IST: ${endDateTimeIST}`);
        if (!isValid(startDateTimeIST) || !isValid(endDateTimeIST)) {
            return interaction.reply({ content: 'Invalid date or time format.', ephemeral: true });
        }

        // Convert IST to UTC
        const convertISTtoUTC = (date) => {
            const utcDate = new Date(date.getTime() - (5 * 60 + 30) * 60000); // Subtract 5 hours and 30 minutes
            return utcDate;
        };

        const startDateTimeUTC = convertISTtoUTC(startDateTimeIST);
        const endDateTimeUTC = convertISTtoUTC(endDateTimeIST);
        console.log(`Start DateTime UTC: ${startDateTimeUTC}`);
        console.log(`End DateTime UTC: ${endDateTimeUTC}`);

        // Adjust the dates to ensure they are in the future
        const now = new Date();
        if (startDateTimeUTC <= now || endDateTimeUTC <= now) {
            return interaction.reply({ content: 'Event times must be in the future.', ephemeral: true });
        }

        if (startDateTimeUTC >= endDateTimeUTC) {
            return interaction.reply({ content: 'The start time must be before the end time.', ephemeral: true });
        }

        try {
            const event = await interaction.guild.scheduledEvents.create({
                name,
                scheduledStartTime: startDateTimeUTC.toISOString(),
                scheduledEndTime: endDateTimeUTC.toISOString(),
                privacyLevel: 2, // GUILD_ONLY
                entityType: 2, // VOICE if (channel) else 3, // EXTERNAL if location
                channel: channel,
                location,
                description,
            });

            const notificationChannel = await interaction.guild.channels.fetch(notificationChannelId);
            const embed = new EmbedBuilder()
                .setTitle(`New Event Created: ${name}`)
                .setDescription(description)
                .addFields(
                    { name: 'Start Time', value: format(startDateTimeIST, 'dd-MM-yyyy HH:mm'), inline: true },
                    { name: 'End Time', value: format(endDateTimeIST, 'dd-MM-yyyy HH:mm'), inline: true },
                    { name: 'Event Link', value: `[Join Event](${event.url})` }
                )
                .setColor('#00FF00')
                .setTimestamp()
                .setFooter({ text: 'Event created by your friendly bot' });
            await notificationChannel.send({
                content: `<@&${roleToMention}> A new event has been created!`,
                embeds: [embed],
            });
            await interaction.reply(`Created event: ${event.name}`);
        } catch (error) {
            console.error('Error creating event:', error);
            await interaction.reply({ content: 'There was an error while creating the event!', ephemeral: true });
        }
    },
};