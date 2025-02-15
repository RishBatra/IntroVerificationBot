const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Whitelist = require('../models/whitelist');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage the video call whitelist')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand.setName('add')
        .setDescription('Whitelist a user (allows them to join without video)')
        .addUserOption(option => option.setName('user').setDescription('User to whitelist').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand.setName('remove')
        .setDescription('Remove a user from the whitelist')
        .addUserOption(option => option.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand.setName('list')
        .setDescription('View the list of whitelisted users')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'add') {
      const user = interaction.options.getUser('user');
      const existingEntry = await Whitelist.findOne({ guildId, userId: user.id });
      if (existingEntry) return interaction.reply(`⚠ **${user.tag}** is already whitelisted.`);
      await Whitelist.create({ guildId, userId: user.id });
      return interaction.reply(`✅ **${user.tag}** has been added to the whitelist.`);
    }

    if (subcommand === 'remove') {
      const user = interaction.options.getUser('user');
      const result = await Whitelist.deleteOne({ guildId, userId: user.id });
      if (result.deletedCount === 0) return interaction.reply(`⚠ **${user.tag}** is not in the whitelist.`);
      return interaction.reply(`❌ **${user.tag}** has been removed from the whitelist.`);
    }

    if (subcommand === 'list') {
      const whitelistedUsers = await Whitelist.find({ guildId });
      if (!whitelistedUsers.length) return interaction.reply('⚠ No users are currently whitelisted.');
      return interaction.reply(`📜 **Whitelisted Users:**\n${whitelistedUsers.map(u => `<@${u.userId}>`).join('\n')}`);
    }
  },
};