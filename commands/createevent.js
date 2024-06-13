const { SlashCommandBuilder, MessageEmbed } = require('discord.js');

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
      let day, month, year;

      if (input === 'today') {
        day = today.getDate();
        month = today.getMonth() + 1;
        year = today.getFullYear();
      } else if (input === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        day = tomorrow.getDate();
        month = tomorrow.getMonth() + 1;
        year = tomorrow.getFullYear();
      } else if (input.startsWith('this ')) {
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = daysOfWeek.indexOf(input.split(' ')[1]);
        if (targetDay === -1) {
          return null;
        }
        const currentDay = today.getDay();
        let diff = targetDay - currentDay;
        if (diff < 0) {
          diff += 7;
        }
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + diff);
        day = targetDate.getDate();
        month = targetDate.getMonth() + 1;
        year = targetDate.getFullYear();
      } else {
        const dateParts = input.split(/[:/]/);
        if (dateParts.length !== 3) {
          return null;
        }
        [day, month, year] = dateParts;
        if (year.length === 2) {
          year = `20${year}`;
        }
      }

      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    // Parse date
    const parsedDate = parseNaturalDate(date);
    if (!parsedDate) {
      return interaction.reply({ content: 'Invalid date format. Please use DD:MM:YY, DD/MM/YY, today, tomorrow, or this <day of week>.', ephemeral: true });
    }

    // Convert date to YYYY-MM-DD format
    const [year, month, day] = parsedDate.split('-');

    // Handle time format
    const formatTime = (time) => {
      const meridiemMatch = time.match(/(am|pm)$/i);
      let hours, minutes = '00';

      if (meridiemMatch) {
        const meridiem = meridiemMatch[1].toLowerCase();
        time = time.slice(0, -2);

        if (time.includes(':')) {
          [hours, minutes] = time.split(':');
        } else {
          hours = time.slice(0, -2);
          minutes = time.slice(-2);
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
      const endDate = new Date(`${year}-${month}-${day}T00:00:00`);
      endDate.setDate(endDate.getDate() + 1); // Move to the next day
      const newDay = String(endDate.getDate()).padStart(2, '0');
      const newMonth = String(endDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
      const newYear = endDate.getFullYear();
    }

    const startDateTimeString = `${year}-${month}-${day}T${startTime}:00`;
    const endDateTimeString = `${year}-${month}-${day}T${endTime}:00`;

    console.log(`Start DateTime String: ${startDateTimeString}`);
    console.log(`End DateTime String: ${endDateTimeString}`);

    const startDateTime = new Date(startDateTimeString);
    const endDateTime = new Date(endDateTimeString);

    console.log(`Start DateTime: ${startDateTime}`);
    console.log(`End DateTime: ${endDateTime}`);

    if (isNaN(startDateTime) || isNaN(endDateTime)) {
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

      const embed = new MessageEmbed()
        .setTitle(`New Event Created: ${name}`)
        .setDescription(description)
        .addField('Start Time', startDateTime.toLocaleString(), true)
        .addField('End Time', endDateTime.toLocaleString(), true)
        .addField('Event Link', `[Join Event](${event.url})`)
        .setColor('#00FF00')
        .setTimestamp()
        .setFooter('Event created by your friendly bot');

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
