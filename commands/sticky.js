const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const StickyMessage = require('../models/stickymessage');

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
            .setDescription('The message to stick (use \\n for new lines)')
            .setRequired(true)
            .setMaxLength(2000))
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
        let message = interaction.options.getString('message');
        const color = interaction.options.getString('color') || '#7289DA';

        // Replace \n with actual new lines
        message = message.replace(/\\n/g, '\n');

        // Validate color
        if (!/^#[0-9A-F]{6}$/i.test(color)) {
          return await interaction.editReply('Invalid color format. Please use a valid hex color code (e.g., #0099ff).');
        }

        let stickyMessage = await StickyMessage.findOne({ 
          guildId: interaction.guild.id, 
          channelId: interaction.channel.id 
        });

        if (stickyMessage) {
          stickyMessage.message = message;
          stickyMessage.color = color;
        } else {
          stickyMessage = new StickyMessage({
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
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
          guildId: interaction.guild.id, 
          channelId: interaction.channel.id 
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
            // Continue with removal even if message deletion fails
          }
        }

        // Remove the sticky message from the database
        await StickyMessage.deleteOne({ 
          guildId: interaction.guild.id, 
          channelId: interaction.channel.id 
        });

        await interaction.editReply('Sticky message removed successfully!');
      }
    } catch (error) {
      console.error('Error in sticky command:', error);
      await interaction.editReply('An error occurred while processing the command. Please try again later.');
    }
  },
};
