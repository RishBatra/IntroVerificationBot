const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Only handle DMs
        if (message.guild) return;

        console.log('Received a DM:', message.content);

        const guild = message.client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
            console.error('Guild not found. Please check your GUILD_ID.');
            return;
        }

        const botMember = guild.members.cache.get(message.client.user.id);
        console.log('Bot Permissions in the guild:', botMember.permissions.toArray());

        const serverAvatar = guild.iconURL();

        const embed = new EmbedBuilder()
            .setTitle(`Open a ticket in ${guild.name}`)
            .setDescription('Do you want to open a ticket?')
            .setThumbnail(serverAvatar)
            .setColor(0x00AE86);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_yes')
                .setLabel('✅ Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ticket_no')
                .setLabel('❌ No')
                .setStyle(ButtonStyle.Danger)
        );

        try {
            await message.author.send({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error sending DM to user:', error);
        }
    },
};