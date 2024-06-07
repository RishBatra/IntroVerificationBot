const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Creates a poll')
    .addStringOption(option => 
      option.setName('question')
        .setDescription('The question for the poll')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('option1')
        .setDescription('First option')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('option2')
        .setDescription('Second option')
        .setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString('question');
    const option1 = interaction.options.getString('option1');
    const option2 = interaction.options.getString('option2');

    const pollEmbed = {
      color: 0x0099ff,
      title: 'Poll',
      description: question,
      fields: [
        { name: 'Option 1', value: option1, inline: true },
        { name: 'Option 2', value: option2, inline: true },
      ],
      timestamp: new Date(),
    };

    const pollMessage = await interaction.reply({ embeds: [pollEmbed], fetchReply: true });
    await pollMessage.react('1️⃣');
    await pollMessage.react('2️⃣');
  },
};