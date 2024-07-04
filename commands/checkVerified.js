const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkverified')
        .setDescription('List members with only the verified role'),
    
    async execute(interaction) {
        const VERIFIED_ROLE_NAME = 'verified'; // Replace with the name of your verified role
        const guild = interaction.guild;

        if (!guild) {
            await interaction.reply('This command can only be used in a server.');
            return;
        }

        const verifiedRole = guild.roles.cache.find(role => role.name === VERIFIED_ROLE_NAME);
        if (!verifiedRole) {
            await interaction.reply(`Verified role not found.`);
            console.log('Verified role not found.');
            return;
        }

        const membersWithOnlyVerifiedRole = [];

        await guild.members.fetch(); // Fetch all members
        console.log(`Fetched ${guild.members.cache.size} members.`);

        for (const member of guild.members.cache.values()) {
            if (member.roles.cache.size === 2 && member.roles.cache.has(verifiedRole.id)) {
                membersWithOnlyVerifiedRole.push(member);
            }

            // Adding delay to prevent the bot from going unresponsive
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (membersWithOnlyVerifiedRole.length > 0) {
            const embed = new MessageEmbed()
                .setTitle(`Members with only the "${VERIFIED_ROLE_NAME}" role`)
                .setDescription(membersWithOnlyVerifiedRole.map(member => `${member.user.tag} (<@${member.user.id}>)`).join('\n'))
                .setColor('#00FF00'); // You can customize the color

            await interaction.reply({ embeds: [embed] });
            console.log(`Listed ${membersWithOnlyVerifiedRole.length} members with only the verified role.`);
        } else {
            await interaction.reply(`No members found with only the "${VERIFIED_ROLE_NAME}" role.`);
            console.log(`No members found with only the verified role.`);
        }
    },
};