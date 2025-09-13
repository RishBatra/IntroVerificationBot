const UserActivity = require('../models/userActivity');

// Allowed category IDs copied from commands/audit.js to keep scope consistent
const ALLOWED_CATEGORY_IDS = [
    "692957855770345485", // text channels
    "693017779158253619"  // topics
];

const MS_PER_DAY = 86400000;

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        try {
            if (!message.guild) return;
            if (message.author?.bot) return;

            const channel = message.channel;
            if (!channel || channel.nsfw) return;

            const parentId = channel.parentId ?? channel.parent?.id ?? null;
            if (!parentId || !ALLOWED_CATEGORY_IDS.includes(parentId)) return;

            const epochDay = Math.floor((message.createdTimestamp || Date.now()) / MS_PER_DAY);

            await UserActivity.findOneAndUpdate(
                { guildId: message.guild.id, userId: message.author.id },
                {
                    $inc: { [`buckets.${epochDay}`]: 1 },
                    $set: { updatedAt: new Date() }
                },
                { upsert: true }
            );

            // Opportunistic prune: keep only last 40 days to bound doc size
            // Do this sparsely to minimize write amplification
            if (Math.random() < 0.02) {
                const doc = await UserActivity.findOne({ guildId: message.guild.id, userId: message.author.id }).lean();
                if (doc && doc.buckets) {
                    const cutoff = epochDay - 40;
                    const toUnset = {};
                    for (const key of Object.keys(doc.buckets)) {
                        const day = Number(key);
                        if (Number.isFinite(day) && day < cutoff) {
                            toUnset[`buckets.${key}`] = "";
                        }
                    }
                    if (Object.keys(toUnset).length > 0) {
                        await UserActivity.updateOne(
                            { guildId: message.guild.id, userId: message.author.id },
                            { $unset: toUnset }
                        );
                    }
                }
            }
        } catch (err) {
            console.error('[userActivityTracker] Error tracking message activity', err);
        }
    }
};


