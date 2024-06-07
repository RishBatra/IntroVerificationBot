const { SlashCommandBuilder } = require('discord.js');

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
        .setDescription('The date of the event (DD:MM:YY or DD/MM/YY)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('starttime')
        .setDescription('The start time of the event (HH:MM, HHMM, or HH)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('endtime')
        .setDescription('The end time of the event (HH:MM, HHMM, or HH)')
        .setRequired(true)),
  async execute(interaction) {
    const requiredRoles = ['Admins', 'Contributors', 'Proud Guardians'];
    const memberRoles = interaction.member.roles.cache.map(role => role.name);

    if (!requiredRoles.some(role => memberRoles.includes(role))) {
      return interaction.reply({ content: 'You do not have the required roles to use this command.', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const description = interaction.options.getString('description');
    const channel = interaction.options.getChannel('channel');
    const date = interaction.options.getString('date');
    let startTime = interaction.options.getString('starttime');
    let endTime = interaction.options.getString('endtime');

    console.log(`Date: ${date}, Start Time: ${startTime}, End Time: ${endTime}`);

    // Handle date format
    let [day, month, year] = date.split(/[:/]/);

    if (!day || !month || !year) {
      return interaction.reply({ content: 'Invalid date format. Please use DD:MM:YY or DD/MM/YY.', ephemeral: true });
    }

    // Ensure year is in full format
    year = year.length === 2 ? `20${year}` : year;

    // Handle time format
    const formatTime = (time) => {
      if (time.length === 2) {
        return `${time}:00`;
      } else if (time.length === 4) {
        return `${time.slice(0, 2)}:${time.slice(2)}`;
      }
      return time;
    };

    startTime = formatTime(startTime);
    endTime = formatTime(endTime);

    // Handle endTime being "24:00"
    if (endTime === "24:00") {
      endTime = "00:00";
      const endDate = new Date(`${year}-${month}-${day}T00:00:00`);
      endDate.setDate(endDate.getDate() + 1); // Move to the next day
      day = String(endDate.getDate()).padStart(2, '0');
      month = String(endDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
      year = endDate.getFullYear();
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
      await interaction.reply(`Created event: ${event.name}`);
    } catch (error) {
      console.error('Error creating event:', error);
      await interaction.reply({ content: 'There was an error while creating the event!', ephemeral: true });
    }
  },
};