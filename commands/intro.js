const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('intro')
    .setDescription('Submit your introduction')
    // Add options according to your requirements
    .addStringOption(option => option.setName('age').setDescription('Your age').setRequired(true))
    .addStringOption(option => option.setName('gender').setDescription('Your gender').setRequired(true))
    .addStringOption(option => option.setName('pronouns').setDescription('Your pronouns').setRequired(true))
    .addStringOption(option => option.setName('orientation').setDescription('Your sexual orientation').setRequired(true))
    .addStringOption(option => option.setName('location').setDescription('Your location').setRequired(true))
    .addStringOption(option => option.setName('education').setDescription('Your education/career').setRequired(false))
    .addStringOption(option => option.setName('hobbies').setDescription('Your hobbies').setRequired(false))
    .addStringOption(option => option.setName('trivia').setDescription('Any trivia about you').setRequired(false)),
  async execute(interaction) {
    // Validation and response logic goes here
  },
};
