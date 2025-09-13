const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits
  } = require("discord.js");
  
  // Fixed role IDs
  const GREEN_ROLE_ID = "767712239205351425";
  const STAR_ROLE_ID = "703126088091435019";
  
  // Pronoun roles with IDs + labels
  const PRONOUN_ROLES = {
    "692960596844478465": "He/Him",
    "692960617614540801": "She/Her",
    "692960634786152468": "They/Them",
    "886563278191464478": "Ask for Pronouns"
  };
  
  // Allowed category IDs for counting activity
  const ALLOWED_CATEGORY_IDS = [
    "692957855770345485", // text channels
    "693017779158253619"  // topics
  ];
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("auditactivity")
      .setDescription("Audit a user's eligibility for 18+, Selfies, or NSFW before granting roles")
      .addStringOption(option =>
        option.setName("type")
          .setDescription("Which role type to audit?")
          .setRequired(true)
          .addChoices(
            { name: "18+ SFW", value: "sfw18" },
            { name: "Selfies", value: "selfies" },
            { name: "NSFW", value: "nsfw" }
          )
      )
      .addUserOption(option =>
        option.setName("target")
          .setDescription("The user to audit")
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
  
      const type = interaction.options.getString("type");
      const targetUser = interaction.options.getUser("target");
      const member = await interaction.guild.members.fetch(targetUser.id);
      const guild = interaction.guild;
  
      const now = Date.now();
      const joinDays = Math.floor((now - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24));
  
      // General channels in allowed categories
      const generalChannels = guild.channels.cache.filter(ch =>
        ch.type === ChannelType.GuildText &&
        ch.viewable &&
        !ch.nsfw &&
        ALLOWED_CATEGORY_IDS.includes(ch.parentId) // only from whitelisted categories
      );
  
      let daysToCheck = 14;
      let minMessages = 0;
      let minDistinctDays = 0;
  
      if (type === "sfw18") {
        daysToCheck = 14;
        minMessages = 14 * 15; // 15/day baseline
      }
      if (type === "selfies") {
        daysToCheck = 14;
        minMessages = 50; // baseline activity
      }
      if (type === "nsfw") {
        daysToCheck = 30;
        minDistinctDays = 28; // almost daily
      }
  
      // Count activity
      const since = new Date(now - daysToCheck * 24 * 60 * 60 * 1000);
      let totalMessages = 0;
      let distinctDays = new Set();
  
      for (const channel of generalChannels.values()) {
        let lastId;
        while (true) {
          const fetched = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
          if (!fetched || fetched.size === 0) break;
  
          for (const msg of fetched.values()) {
            if (msg.createdAt < since) break;
            if (msg.author.id === targetUser.id) {
              totalMessages++;
              distinctDays.add(`${msg.createdAt.getUTCFullYear()}-${msg.createdAt.getUTCMonth()}-${msg.createdAt.getUTCDate()}`);
            }
          }
  
          lastId = fetched.last().id;
          if (fetched.last().createdAt < since) break;
        }
      }
  
      // Pronoun role check
      const userPronounRoles = Object.entries(PRONOUN_ROLES)
        .filter(([id]) => member.roles.cache.has(id))
        .map(([_, name]) => name);
  
      const hasPronounRole = userPronounRoles.length > 0;
  
      // Checks
      const checks = [];
      let color = 0x5865F2;
      let titleIcon = "📋";
      let verdict = "❌ Not Eligible";
  
      if (type === "sfw18") {
        color = 0xE67E22;
        titleIcon = "🔞";
        checks.push({ name: "🟢 Green Role", value: member.roles.cache.has(GREEN_ROLE_ID) ? "✅ Yes" : "❌ No", inline: true });
        checks.push({ name: "👤 Pronouns Role", value: hasPronounRole ? `✅ ${userPronounRoles.join(", ")}` : "❌ None", inline: true });
        checks.push({ name: "📅 Time in Server", value: joinDays >= 14 ? `✅ ${joinDays} days` : `❌ ${joinDays} days (<14)`, inline: true });
        checks.push({ name: "💬 Messages", value: totalMessages >= minMessages ? `✅ ${totalMessages}/${minMessages}` : `❌ ${totalMessages}/${minMessages}`, inline: true });
  
        if (member.roles.cache.has(GREEN_ROLE_ID) && hasPronounRole && joinDays >= 14 && totalMessages >= minMessages) {
          verdict = "✅ Eligible";
          color = 0x2ECC71; // green if pass
        } else {
          color = 0xE74C3C; // red if fail
        }
      }
  
      if (type === "selfies") {
        color = 0x2ECC71;
        titleIcon = "📸";
        checks.push({ name: "🟢 Green Role", value: member.roles.cache.has(GREEN_ROLE_ID) ? "✅ Yes" : "❌ No", inline: true });
        checks.push({ name: "📅 Time in Server", value: joinDays >= 14 ? `✅ ${joinDays} days` : `❌ ${joinDays} days (<14)`, inline: true });
        checks.push({ name: "💬 Messages", value: totalMessages >= minMessages ? `✅ ${totalMessages}/${minMessages}` : `❌ ${totalMessages}/${minMessages}`, inline: true });
  
        if (member.roles.cache.has(GREEN_ROLE_ID) && joinDays >= 14 && totalMessages >= minMessages) {
          verdict = "✅ Eligible";
          color = 0x2ECC71;
        } else {
          color = 0xE74C3C;
        }
      }
  
      if (type === "nsfw") {
        color = 0x9B59B6;
        titleIcon = "⭐";
        checks.push({ name: "⭐ Star Role", value: member.roles.cache.has(STAR_ROLE_ID) ? "✅ Yes" : "❌ No", inline: true });
        checks.push({ name: "📅 Time in Server", value: joinDays >= 30 ? `✅ ${joinDays} days` : `❌ ${joinDays} days (<30)`, inline: true });
        checks.push({ name: "🗓 Active Days", value: distinctDays.size >= minDistinctDays ? `✅ ${distinctDays.size}/${minDistinctDays}` : `❌ ${distinctDays.size}/${minDistinctDays}`, inline: true });
  
        if (member.roles.cache.has(STAR_ROLE_ID) && joinDays >= 30 && distinctDays.size >= minDistinctDays) {
          verdict = "✅ Eligible";
          color = 0x2ECC71;
        } else {
          color = 0xE74C3C;
        }
      }
  
      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${targetUser.username} — Pre-Audit`, iconURL: targetUser.displayAvatarURL() })
        .setTitle(`${titleIcon} ${type.toUpperCase()} Eligibility Check`)
        .addFields(checks)
        .addFields({ name: "📝 Verdict", value: verdict })
        .setTimestamp()
        .setFooter({ text: "Audit Bot • Pre-Granting Check", iconURL: guild.iconURL() });
  
      return interaction.editReply({ embeds: [embed] });
    }
  };