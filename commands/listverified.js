const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listverified')
        .setDescription('List members who only have the Verified role'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            await guild.members.fetch();

            const verifiedRole = guild.roles.cache.find(role => role.name === "Verified");
            if (!verifiedRole) {
                return interaction.editReply("The 'Verified' role doesn't exist in this server.");
            }

            const verifiedOnlyMembers = guild.members.cache.filter(member => 
                member.roles.cache.size === 2 && member.roles.cache.has(verifiedRole.id)
            );

            if (verifiedOnlyMembers.size === 0) {
                return interaction.editReply("No members found with only the 'Verified' role.");
            }

            const memberList = verifiedOnlyMembers.map(member => `${member.user.tag} (${member.id})`).join('\n');

            const embed = new MessageEmbed()
                .setTitle("Members with only 'Verified' role")
                .setColor('#0099ff')
                .setTimestamp();

            if (memberList.length <= 4096) {
                embed.setDescription(memberList);
                await interaction.editReply({ embeds: [embed] });
            } else {
                const chunks = this.chunkString(memberList, 4096);
                for (let i = 0; i < chunks.length; i++) {
                    const chunkEmbed = new MessageEmbed()
                        .setTitle(`Members with only 'Verified' role (Part ${i + 1})`)
                        .setDescription(chunks[i])
                        .setColor('#0099ff')
                        .setTimestamp();
                    
                    if (i === 0) {
                        await interaction.editReply({ embeds: [chunkEmbed] });
                    } else {
                        await interaction.followUp({ embeds: [chunkEmbed] });
                    }
                    
                    // Add a delay between messages to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error('Error in listverified command:', error);
            await interaction.editReply('An error occurred while executing the command. Please try again later.');
        }
    },

    chunkString(str, length) {
        const chunks = [];
        let i = 0;
        while (i < str.length) {
            chunks.push(str.slice(i, i + length));
            i += length;
        }
        return chunks;
    }
};