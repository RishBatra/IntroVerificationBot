const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js'); // Updated import
const Warning = require('../models/warnings'); // Ensure the correct path

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for the warning').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.roles.cache.some(role => role.name === 'Admins')) {
      return interaction.reply('You do not have permission to use this command.');
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    let userWarnings = await Warning.findOne({ userId: user.id });
    if (!userWarnings) {
      userWarnings = new Warning({ userId: user.id, warnings: [] });
    }

    userWarnings.warnings.push({ reason });
    await userWarnings.save();

    const warningCount = userWarnings.warnings.length;

    const embed = new EmbedBuilder() // Updated to EmbedBuilder
      .setTitle('Warning')
      .setDescription(reason)
      .addFields({ name: 'Warnings', value: `${warningCount}/3` })
      .setColor('#FF0000'); // Use a valid hex color code

    try {
      await user.send({ embeds: [embed] });
    } catch (err) {
      console.error('Could not send DM to the user.');
    }

    await interaction.reply(`${interaction.user} warned ${user} for: ${reason}`);

    if (warningCount >= 3) {
      const adminChannel = interaction.guild.channels.cache.find(channel => channel.name === 'admins-spam');
      if (adminChannel) {
        adminChannel.send(`User ${user} has reached 3 warnings.`);
      }
    }
  },
};
