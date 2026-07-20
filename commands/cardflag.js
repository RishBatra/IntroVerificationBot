const { SlashCommandBuilder } = require('discord.js');
const CardPreference = require('../models/cardPreference');
const { getFlag, getFlagChoices, DEFAULT_FLAG_VALUE } = require('../utils/prideFlags');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cardflag')
        .setDescription('Choose a pride flag background for your profile card')
        .addStringOption(option =>
            option
                .setName('flag')
                .setDescription('Pride flag (start typing to search)')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const matches = getFlagChoices()
            .filter(choice => choice.name.toLowerCase().includes(focused))
            .slice(0, 25);
        await interaction.respond(matches);
    },

    async execute(interaction) {
        try {
            const VERIFIED_ROLE_ID = '692985789608362005';
            const verifiedRole =
                interaction.guild.roles.cache.get(VERIFIED_ROLE_ID) ||
                interaction.guild.roles.cache.find(role => role.name === 'Verified');

            if (!verifiedRole || !interaction.member.roles.cache.has(verifiedRole.id)) {
                return interaction.reply({
                    content: '❌ You must be verified to customise your profile card.',
                    ephemeral: true,
                });
            }

            const value = interaction.options.getString('flag');

            if (value === DEFAULT_FLAG_VALUE) {
                await CardPreference.deleteOne({
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                });
                return interaction.reply({
                    content: '✅ Your card is back to the server default background. Run `/profile` to see it.',
                    ephemeral: true,
                });
            }

            const flag = getFlag(value);
            if (!flag) {
                return interaction.reply({
                    content: '❌ Unknown flag. Pick one from the autocomplete list.',
                    ephemeral: true,
                });
            }

            await CardPreference.findOneAndUpdate(
                { guildId: interaction.guild.id, userId: interaction.user.id },
                { flag: value },
                { upsert: true }
            );

            return interaction.reply({
                content: `✅ Your profile card now uses the **${flag.name}** flag background. Run \`/profile\` to see it.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error('[cardflag] Error:', error);
            return interaction.reply({
                content: '❌ An error occurred while saving your card preference.',
                ephemeral: true,
            });
        }
    },
};
