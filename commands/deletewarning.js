const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Warning = require('../models/warnings'); // Ensure the correct path

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletewarning')
    .setDescription('Delete warnings for a user')
    .addUserOption(option => option.setName('user').setDescription('The user to delete warnings for').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.roles.cache.some(role => role.name === 'Admins')) {
      return interaction.reply('You do not have permission to use this command.');
    }

    const user = interaction.options.getUser('user');
    const userWarnings = await Warning.findOne({ userId: user.id });

    if (!userWarnings || userWarnings.warnings.length === 0) {
      return interaction.reply(`No warnings found for ${user}.`);
    }

    const options = userWarnings.warnings.map((warning, index) => ({
      label: `Warning ${index + 1}: ${warning.reason}`,
      value: warning._id.toString(),
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select-warning')
        .setPlaceholder('Select a warning to delete')
        .addOptions(options)
    );

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('delete-all-warnings')
        .setLabel('Delete All Warnings')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ content: `Select a warning to delete for ${user}:`, components: [row, buttonRow] });

    const filter = i => (i.customId === 'select-warning' || i.customId === 'delete-all-warnings') && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
      if (i.customId === 'select-warning') {
        const warningId = i.values[0];
        userWarnings.warnings = userWarnings.warnings.filter(w => w._id.toString() !== warningId);
        await userWarnings.save();
        await i.update({ content: `Warning ${warningId} for ${user} has been deleted.`, components: [] });
      } else if (i.customId === 'delete-all-warnings') {
        await Warning.deleteOne({ userId: user.id });
        await i.update({ content: `All warnings for ${user} have been deleted.`, components: [] });
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({ content: 'No warnings were deleted.', components: [] });
      }
    });
  },
};
