const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parse, format, addDays, isValid } = require('date-fns');

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
        .setDescription('The channel for the event')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('date')
        .setDescription('The date of the event (DD:MM:YY, DD/MM/YY, today, tomorrow, or this <day of week>)')
        .setRequired(true))
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
    const channel = interaction.options.getChannel('channel');
    let date = interaction.options.getString('date').toLowerCase();
    let startTime = interaction.options.getString('starttime');
    let endTime = interaction.options.getString('endtime');

    console.log(`Date: ${date}, Start Time: ${startTime}, End Time: ${endTime}`);

    // Function to parse natural language dates
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

    // Parse date
    const parsedDate = parseNaturalDate(date);
    if (!isValid(parsedDate)) {
      return interaction.reply({ content: 'Invalid date format. Please use DD:MM:YY, DD/MM/YY, today, tomorrow, or this <day of week>.', ephemeral: true });
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
      parsedDate = addDays(parsedDate, 1);
    }

    // Convert IST to UTC
    const convertISTToUTC = (date, time) => {
      const [hours, minutes] = time.split(':');
      const localDate = new Date(date);
      localDate.setHours(hours - 5, minutes - 30); // IST is UTC +5:30
      return new Date(localDate.getTime() + (5.5 * 60 * 60 * 1000));
    };

    const startDateTime = convertISTToUTC(parsedDate, startTime);
    const endDateTime = convertISTToUTC(parsedDate, endTime);

    console.log(`Start DateTime: ${startDateTime}`);
    console.log(`End DateTime: ${endDateTime}`);

    if (!isValid(startDateTime) || !isValid(endDateTime)) {
      return interaction.reply({ content: 'Invalid date or time format.', ephemeral: true });
    }

    // Adjust the dates to ensure they are in the future
    const now = new Date();
    if (startDateTime <= now || endDateTime <= now) {
      return interaction.reply({ content: 'Event times must be in the future.', ephemeral: true });
    }

    if (startDateTime >= endDateTime) {
      return interaction.reply({ content: 'The start time must be before the end time.', ephemeral: true });
    }

    try {
      const event = await interaction.guild.scheduledEvents.create({
        name,
        scheduledStartTime: startDateTime.toISOString(),
        scheduledEndTime: endDateTime.toISOString(),
        privacyLevel: 2, // GUILD_ONLY
        entityType: 2, // VOICE
        channel: channel.id,
        description,
      });

      const notificationChannel = await interaction.guild.channels.fetch(notificationChannelId);

      const embed = new EmbedBuilder()
        .setTitle(`New Event Created: ${name}`)
        .setDescription(description)
        .addFields(
          { name: 'Start Time', value: format(startDateTime, 'yyyy-MM-dd HH:mm:ss'), inline: true },
          { name: 'End Time', value: format(endDateTime, 'yyyy-MM-dd HH:mm:ss'), inline: true },
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
