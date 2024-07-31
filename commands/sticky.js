const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const StickyMessage = require('../models/stickyMessage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Manage sticky messages in channels')
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set a sticky message for the current channel')
        .addStringOption(option =>
          option.setName('message')
            .setDescription('The message to stick')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('color')
            .setDescription('The color of the embed (hex code)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove the sticky message from the current channel'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'set') {
        const message = interaction.options.getString('message');
        const color = interaction.options.getString('color') || '#0099ff';

        // Validate color
        if (!/^#[0-9A-F]{6}$/i.test(color)) {
          return await interaction.editReply('Invalid color format. Please use a valid hex color code (e.g., #0099ff).');
        }

        let stickyMessage = await StickyMessage.findOne({ 
          guildId: interaction.guildId, 
          channelId: interaction.channelId 
        });

        if (stickyMessage) {
          stickyMessage.message = message;
          stickyMessage.color = color;
        } else {
          stickyMessage = new StickyMessage({
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            message: message,
            color: color
          });
        }

        await stickyMessage.save();

        // Delete the previous sticky message if it exists
        if (stickyMessage.lastMessageId) {
          try {
            const oldMessage = await interaction.channel.messages.fetch(stickyMessage.lastMessageId);
            await oldMessage.delete();
          } catch (error) {
            console.error('Error deleting old sticky message:', error);
          }
        }

        // Send the new sticky message
        const embed = new EmbedBuilder()
          .setDescription(message)
          .setColor(color);

        const sentMessage = await interaction.channel.send({ embeds: [embed] });
        stickyMessage.lastMessageId = sentMessage.id;
        await stickyMessage.save();

        await interaction.editReply('Sticky message set successfully!');

      } else if (subcommand === 'remove') {
        const stickyMessage = await StickyMessage.findOne({ 
          guildId: interaction.guildId, 
          channelId: interaction.channelId 
        });

        if (!stickyMessage) {
          return await interaction.editReply('There is no sticky message set for this channel.');
        }

        // Delete the sticky message if it exists
        if (stickyMessage.lastMessageId) {
          try {
            const message = await interaction.channel.messages.fetch(stickyMessage.lastMessageId);
            await message.delete();
          } catch (error) {
            console.error('Error deleting sticky message:', error);
          }
        }

        await StickyMessage.deleteOne({ 
          guildId: interaction.guildId, 
          channelId: interaction.channelId 
        });

        await interaction.editReply('Sticky message removed successfully!');
      }
    } catch (error) {
      console.error('Error in sticky command:', error);
      await interaction.editReply('An error occurred while processing the command. Please try again later.');
    }
  },
};
