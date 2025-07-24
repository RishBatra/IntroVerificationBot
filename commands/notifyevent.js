const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { format } = require('date-fns');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notifyevent')
        .setDescription('Send a notification for an existing scheduled event')
        .addStringOption(option =>
            option.setName('event')
                .setDescription('Select an event to notify about')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),
    async autocomplete(interaction) {
        // Only show upcoming events
        const events = await interaction.guild.scheduledEvents.fetch();
        const now = new Date();
        const choices = events.filter(ev => ev.scheduledStartAt > now)
            .map(ev => ({
                name: `${ev.name} (${format(ev.scheduledStartAt, 'dd-MM HH:mm')})`,
                value: ev.id
            }));
        await interaction.respond(choices.slice(0, 25)); // Discord max 25 options
    },
    async execute(interaction) {
        const requiredRoles = new Set(['Admins', 'Proud Guardians']);
        const memberRoles = new Set(interaction.member.roles.cache.map(role => role.name));
        const roleToMention = '861562283921244161'; // Same as in createevent.js
        const notificationChannelId = '863436760234065971'; // Same as in createevent.js

        if (![...requiredRoles].some(role => memberRoles.has(role))) {
            return interaction.reply({ content: 'You do not have the required roles to use this command.', ephemeral: true });
        }

        const eventId = interaction.options.getString('event');
        let event;
        try {
            event = await interaction.guild.scheduledEvents.fetch(eventId);
        } catch (err) {
            return interaction.reply({ content: 'Could not find the selected event.', ephemeral: true });
        }
        if (!event) {
            return interaction.reply({ content: 'Could not find the selected event.', ephemeral: true });
        }

        // Format times in IST
        const toIST = (date) => {
            const ist = new Date(date.getTime() + (5 * 60 + 30) * 60000);
            return ist;
        };
        const startIST = toIST(event.scheduledStartAt);
        const endIST = event.scheduledEndAt ? toIST(event.scheduledEndAt) : null;

        const embed = new EmbedBuilder()
            .setTitle(`Event: ${event.name}`)
            .setDescription(event.description || 'No description')
            .addFields(
                { name: 'Start Time', value: format(startIST, 'dd-MM-yyyy HH:mm'), inline: true },
                ...(endIST ? [{ name: 'End Time', value: format(endIST, 'dd-MM-yyyy HH:mm'), inline: true }] : []),
                { name: 'Event Link', value: `[Join Event](${event.url})` }
            )
            .setColor('#00FF00')
            .setTimestamp()
            .setFooter({ text: 'Event notification by your friendly bot' });

        try {
            const notificationChannel = await interaction.guild.channels.fetch(notificationChannelId);
            await notificationChannel.send({
                content: `<@&${roleToMention}> Reminder for an upcoming event!`,
                embeds: [embed],
            });
            await interaction.reply({ content: `Notification sent for event: ${event.name}`, ephemeral: true });
        } catch (error) {
            console.error('Error sending event notification:', error);
            await interaction.reply({ content: 'There was an error while sending the notification!', ephemeral: true });
        }
    },
}; 