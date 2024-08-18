const { SlashCommandBuilder } = require('@discordjs/builders');
const { Client } = require('@notionhq/client');

// Initialize Notion client
const notionClient = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = 'c9590a734ae44121ae1f3546b9ab5d61';
const ALLOWED_ROLE_ID = '692985789608362005';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addbusiness')
    .setDescription('Add a new business to the Notion database')
    .addStringOption(option => 
      option.setName('name')
        .setDescription('The name of the business')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('category')
        .setDescription('The category of the business')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('location_type')
        .setDescription('The type of location for the business')
        .setRequired(true)
        .addChoices(
          { name: 'Online', value: 'online' },
          { name: 'None', value: 'none' },
          { name: 'Enter Location', value: 'enter' }
        ))
    .addStringOption(option => 
      option.setName('location')
        .setDescription('The specific location of the business (if applicable)')
        .setRequired(false))
    .addStringOption(option => 
      option.setName('url')
        .setDescription('The website URL of the business (optional)')
        .setRequired(false)),
  
  async execute(interaction) {
    // Check if the user has the required role
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply();

    const businessName = interaction.options.getString('name');
    const category = interaction.options.getString('category');
    const locationType = interaction.options.getString('location_type');
    const specificLocation = interaction.options.getString('location');
    const url = interaction.options.getString('url');

    // Determine the final location value
    let finalLocation;
    switch (locationType) {
      case 'online':
        finalLocation = 'Online';
        break;
      case 'none':
        finalLocation = 'None';
        break;
      case 'enter':
        finalLocation = specificLocation || 'Not specified';
        break;
      default:
        finalLocation = 'Not specified';
    }

    try {
      // Fetch current database to check existing categories
      const { properties } = await notionClient.databases.retrieve({ database_id: DATABASE_ID });
      const categoryOptions = properties['Category'].select.options;

      // Check if the category exists, if not, add it
      if (!categoryOptions.some(option => option.name.toLowerCase() === category.toLowerCase())) {
        await notionClient.databases.update({
          database_id: DATABASE_ID,
          properties: {
            'Category': {
              select: {
                options: [...categoryOptions, { name: category }]
              }
            }
          }
        });
      }

      // Create the page in Notion
      const response = await notionClient.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: {
          'Business Name': { title: [{ text: { content: businessName } }] },
          'Category': { select: { name: category } },
          'Location': { rich_text: [{ text: { content: finalLocation } }] },
          'URL': url ? { url: url } : null,
          'Contributor': { rich_text: [{ text: { content: interaction.user.username } }] },
        },
      });

      await interaction.editReply(`Business "${businessName}" added successfully!`);
    } catch (error) {
      console.error('Error adding business to Notion:', error);
      await interaction.editReply('There was an error adding the business. Please try again later.');
    }
  },
};