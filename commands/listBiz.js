const { SlashCommandBuilder } = require('@discordjs/builders');
const { Client } = require('@notionhq/client');
const { EmbedBuilder } = require('discord.js');

// Initialize Notion client
const notionClient = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = 'c9590a734ae44121ae1f3546b9ab5d61';
const ALLOWED_ROLE_ID = '692985789608362005';
const FULL_LIST_URL = 'https://lgbtqindia.notion.site/Queer-Businesses-3c8fba6e280d4553bd01105527649c57';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewbusinesses')
    .setDescription('View the list of businesses from the Notion database')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Filter businesses by category (optional)')
        .setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply();

    const categoryFilter = interaction.options.getString('category');

    try {
      let filter = undefined;
      if (categoryFilter) {
        filter = {
          property: 'Category',
          select: {
            equals: categoryFilter
          }
        };
      }

      const response = await notionClient.databases.query({
        database_id: DATABASE_ID,
        filter: filter,
        sorts: [{ property: 'Business Name', direction: 'ascending' }],
      });

      if (response.results.length === 0) {
        return interaction.editReply('No businesses found.' + (categoryFilter ? ` Category: ${categoryFilter}` : ''));
      }

      const businesses = response.results.map(page => ({
        name: page.properties['Business Name'].title[0]?.plain_text || 'Unnamed',
        category: page.properties['Category'].select?.name || 'Uncategorized',
        location: page.properties['Location'].rich_text[0]?.plain_text || 'Not specified',
        url: page.properties['URL'].url || null
      }));

      const embed = new EmbedBuilder()
        .setTitle('Business List')
        .setColor(0x0099FF)
        .setDescription(
          `${categoryFilter ? `Filtered by category: ${categoryFilter}\n\n` : 'All businesses\n\n'}` +
          `[View full list here](${FULL_LIST_URL})`
        )
        .setTimestamp();

      businesses.forEach(business => {
        let fieldValue = `Category: ${business.category}\nLocation: ${business.location}`;
        if (business.url) {
          fieldValue += `\nWebsite: ${business.url}`;
        } else {
          fieldValue += '\nNo website provided';
        }
        embed.addFields({ name: business.name, value: fieldValue });
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching businesses from Notion:', error);
      await interaction.editReply('There was an error fetching the businesses. Please try again later.');
    }
  },
};