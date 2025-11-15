const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits
  } = require("discord.js");
  const UserActivity = require("../models/userActivity");
  const VoiceSession = require("../models/voiceSession");
  const MS_PER_DAY = 86400000;
  
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
  
  /**
   * Get total voice hours for a user from MongoDB
   * @param {string} guildId 
   * @param {string} userId 
   * @returns {Promise<number>} Total hours
   */
  async function getVoiceHours(guildId, userId) {
    try {
      const result = await VoiceSession.aggregate([
        { $match: { guildId, userId } },
        { $group: { _id: null, totalMs: { $sum: '$durationMs' } } }
      ]);
      
      if (!result || result.length === 0) return 0;
      
      const totalMs = result[0].totalMs || 0;
      const hours = totalMs / (1000 * 60 * 60);
      return hours;
    } catch (error) {
      console.error('[auditactivity] Error fetching voice hours:', error);
      return 0;
    }
  }
  
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
      .addBooleanOption(option =>
        option.setName("fallback")
          .setDescription("Force history crawl instead of DB (slower)")
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option.setName("notify")
          .setDescription("Notify you in channel when audit completes")
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
  
      const type = interaction.options.getString("type");
      const targetUser = interaction.options.getUser("target");
      const forceFallback = interaction.options.getBoolean("fallback") ?? false;
      const notifyInvoker = interaction.options.getBoolean("notify") ?? false;
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
  
      // Count activity (prefer database; fallback to history crawl)
      let totalMessages = 0;
      let distinctDayCount = 0;

      // Try fast path from MongoDB activity buckets
      const shouldUseDb = !forceFallback;
      let usedDb = false;
      if (shouldUseDb) {
        try {
          const today = Math.floor(now / MS_PER_DAY);
          const doc = await UserActivity.findOne({ guildId: guild.id, userId: targetUser.id }).lean();
          if (doc && doc.buckets) {
            let sum14 = 0;
            let days30 = 0;
            for (const [dayStr, count] of Object.entries(doc.buckets)) {
              const day = Number(dayStr);
              if (!Number.isFinite(day)) continue;
              if (day >= today - 13) sum14 += count;
              if (day >= today - 29 && count > 0) days30 += 1;
            }
            totalMessages = sum14; // used for sfw18/selfies
            distinctDayCount = days30; // used for nsfw
            usedDb = true;
          }
        } catch (_) {
          // ignore and fall through to crawl
        }
      }

      if (!usedDb) {
        // Fallback to fetching recent history (slower)
        const since = new Date(now - daysToCheck * 24 * 60 * 60 * 1000);
        const perDayCounts = new Map();
        for (const channel of generalChannels.values()) {
          let lastId;
          while (true) {
            const fetched = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
            if (!fetched || fetched.size === 0) break;

            for (const msg of fetched.values()) {
              if (msg.createdAt < since) break;
              if (msg.author.id === targetUser.id) {
                totalMessages++;
                const bucket = Math.floor(msg.createdTimestamp / MS_PER_DAY);
                perDayCounts.set(bucket, (perDayCounts.get(bucket) || 0) + 1);
              }
            }

            lastId = fetched.last().id;
            if (fetched.last().createdAt < since) break;
          }
        }
        distinctDayCount = perDayCounts.size;

        // Backfill database so future audits are instant
        if (perDayCounts.size > 0) {
          try {
            const maxUpdate = {};
            for (const [day, count] of perDayCounts.entries()) {
              maxUpdate[`buckets.${day}`] = count;
            }
            await UserActivity.updateOne(
              { guildId: guild.id, userId: targetUser.id },
              { $max: maxUpdate, $set: { updatedAt: new Date() } },
              { upsert: true }
            );
          } catch (e) {
            console.error('[auditactivity] Failed to backfill UserActivity from fallback scan', e);
          }
        }
      }
  
      // Pronoun role check
      const userPronounRoles = Object.entries(PRONOUN_ROLES)
        .filter(([id]) => member.roles.cache.has(id))
        .map(([_, name]) => name);
  
      const hasPronounRole = userPronounRoles.length > 0;
  
      // Get voice hours
      const vcHours = await getVoiceHours(guild.id, targetUser.id);
  
      // Checks
      const checks = [];
      let color = 0x5865F2;
      let titleIcon = "📋";
      let verdict = "❌ Not Eligible";
  
      if (type === "sfw18") {
        color = 0xE67E22;
        titleIcon = "🔞";
        const hasGreenRole = member.roles.cache.has(GREEN_ROLE_ID);
        const meetsVcRequirement = vcHours >= 10;
        const meetsRoleOrVc = hasGreenRole || meetsVcRequirement;
        
        checks.push({ name: "🟢 Green Role", value: hasGreenRole ? "✅ Yes" : "❌ No", inline: true });
        checks.push({ name: "🎧 Voice Hours", value: meetsVcRequirement ? `✅ ${vcHours.toFixed(1)}/10 hours` : `❌ ${vcHours.toFixed(1)}/10 hours`, inline: true });
        checks.push({ name: "👤 Pronouns Role", value: hasPronounRole ? `✅ ${userPronounRoles.join(", ")}` : "❌ None", inline: true });
        checks.push({ name: "📅 Time in Server", value: joinDays >= 14 ? `✅ ${joinDays} days` : `❌ ${joinDays} days (<14)`, inline: true });
        checks.push({ name: "💬 Messages", value: totalMessages >= minMessages ? `✅ ${totalMessages}/${minMessages}` : `❌ ${totalMessages}/${minMessages}`, inline: true });
  
        if (meetsRoleOrVc && hasPronounRole && joinDays >= 14 && totalMessages >= minMessages) {
          verdict = "✅ Eligible";
          color = 0x2ECC71; // green if pass
        } else {
          color = 0xE74C3C; // red if fail
        }
      }
  
      if (type === "selfies") {
        color = 0x2ECC71;
        titleIcon = "📸";
        const hasGreenRole = member.roles.cache.has(GREEN_ROLE_ID);
        const meetsVcRequirement = vcHours >= 10;
        const meetsRoleOrVc = hasGreenRole || meetsVcRequirement;
        
        checks.push({ name: "🟢 Green Role", value: hasGreenRole ? "✅ Yes" : "❌ No", inline: true });
        checks.push({ name: "🎧 Voice Hours", value: meetsVcRequirement ? `✅ ${vcHours.toFixed(1)}/10 hours` : `❌ ${vcHours.toFixed(1)}/10 hours`, inline: true });
        checks.push({ name: "📅 Time in Server", value: joinDays >= 14 ? `✅ ${joinDays} days` : `❌ ${joinDays} days (<14)`, inline: true });
        checks.push({ name: "💬 Messages", value: totalMessages >= minMessages ? `✅ ${totalMessages}/${minMessages}` : `❌ ${totalMessages}/${minMessages}`, inline: true });
  
        if (meetsRoleOrVc && joinDays >= 14 && totalMessages >= minMessages) {
          verdict = "✅ Eligible";
          color = 0x2ECC71;
        } else {
          color = 0xE74C3C;
        }
      }
  
      if (type === "nsfw") {
        color = 0x9B59B6;
        titleIcon = "⭐";
        const hasStarRole = member.roles.cache.has(STAR_ROLE_ID);
        const meetsVcRequirement = vcHours >= 30;
        const meetsRoleOrVc = hasStarRole || meetsVcRequirement;
        
        checks.push({ name: "⭐ Star Role", value: hasStarRole ? "✅ Yes" : "❌ No", inline: true });
        checks.push({ name: "🎧 Voice Hours (Star)", value: meetsVcRequirement ? `✅ ${vcHours.toFixed(1)}/30 hours` : `❌ ${vcHours.toFixed(1)}/30 hours`, inline: true });
        checks.push({ name: "📅 Time in Server", value: joinDays >= 30 ? `✅ ${joinDays} days` : `❌ ${joinDays} days (<30)`, inline: true });
        checks.push({ name: "🗓 Active Days", value: distinctDayCount >= minDistinctDays ? `✅ ${distinctDayCount}/${minDistinctDays}` : `❌ ${distinctDayCount}/${minDistinctDays}`, inline: true });
  
        if (meetsRoleOrVc && joinDays >= 30 && distinctDayCount >= minDistinctDays) {
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
  
      const response = await interaction.editReply({ embeds: [embed] });

      // Optional ping to the command invoker (non-ephemeral) — only when fallback crawl was used
      if (notifyInvoker && !usedDb) {
        const mentionContent = `<@${interaction.user.id}> Audit complete for <@${targetUser.id}> (${type.toUpperCase()}).`;
        try {
          await interaction.followUp({
            content: mentionContent,
            allowedMentions: { users: [interaction.user.id, targetUser.id] },
            ephemeral: false
          });
        } catch (e) {
          console.error('Failed to send notify ping:', e);
        }
      }

      return response;
    }
  };