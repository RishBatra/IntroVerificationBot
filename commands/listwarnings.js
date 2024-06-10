const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const Warning = require('../models/warnings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listwarnings')
    .setDescription('List warnings for a user')
    .addUserOption(option => option.setName('user').setDescription('The user to list warnings for').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.roles.cache.some(role => ['Admins', 'Proud Guardians'].includes(role.name))) {
      return interaction.reply('You do not have permission to use this command.');
    }

    const user = interaction.options.getUser('user');
    const userWarnings = await Warning.findOne({ userId: user.id });

    if (!userWarnings || userWarnings.warnings.length === 0) {
      return interaction.reply(`${user} has no warnings.`);
    }

    const warningsList = userWarnings.warnings.map((w, i) => {
      const date = w.timestamp ? new Date(w.timestamp).toDateString() : 'Unknown date';
      return `${i + 1}. ${w.reason} (on ${date})`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`Warnings for ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
        { name: 'Number of Warnings', value: `${userWarnings.warnings.length}`, inline: true },
        { name: 'Warnings', value: warningsList }
      )
      .setColor(0xFFFF00);

    await interaction.reply({ embeds: [embed] });
  },
};
