const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const BACKGROUND_PATH = path.join(__dirname, '../assets/profile-bg.png');
let backgroundImagePromise = null;

function getBackgroundImage() {
    if (!backgroundImagePromise) {
        backgroundImagePromise = loadImage(BACKGROUND_PATH).catch(() => null);
    }
    return backgroundImagePromise;
}

// Scale the image to fully cover the canvas, cropping overflow evenly
function drawCover(ctx, image, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
}

function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function drawRoundedImage(ctx, image, x, y, size, radius) {
    ctx.save();
    roundRect(ctx, x, y, size, size, radius);
    ctx.clip();
    ctx.drawImage(image, x, y, size, size);
    ctx.restore();
}

function truncate(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(`${truncated}…`).width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return `${truncated}…`;
}

function formatNumber(n) {
    return Number(n || 0).toLocaleString('en-US');
}

function buildSubtitle(pronounDisplay, title) {
    const cleanTitle = title && String(title).trim() ? String(title).trim() : null;
    if (pronounDisplay && cleanTitle) return `${pronounDisplay} · ${cleanTitle}`;
    if (pronounDisplay) return pronounDisplay;
    if (cleanTitle) return cleanTitle;
    return 'No title yet';
}

function buildProgressPill({ rank, pointsRemaining, nextRank }) {
    if (!rank) return 'Unranked';
    if (rank === 1) return 'Top of the server';
    if (nextRank == null || pointsRemaining == null) return `Rank #${rank}`;
    return `${formatNumber(pointsRemaining)} pts to rank #${nextRank}`;
}

function formatMemberSince(joinedAt) {
    if (!joinedAt) return null;
    const date = joinedAt instanceof Date ? joinedAt : new Date(joinedAt);
    if (Number.isNaN(date.getTime())) return null;
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `Member since ${month} ${year}`;
}

/**
 * Build a member rank card from prepared content fields.
 * @returns {Promise<Buffer>}
 */
async function buildProfileCard({
    avatarUrl,
    username,
    pronounDisplay,
    title,
    rank,
    pointsRemaining,
    nextRank,
    score,
    vcHours,
    vcStreak,
    joinedAt,
}) {
    const width = 900;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background: server ribbon artwork, falling back to a plain gradient
    const backgroundImage = await getBackgroundImage();
    if (backgroundImage) {
        drawCover(ctx, backgroundImage, width, height);
        // Dark scrim so text stays readable — heavier on the text-dense left,
        // lighter on the right so the ribbon colours show through
        const scrim = ctx.createLinearGradient(0, 0, width, 0);
        scrim.addColorStop(0, 'rgba(8, 8, 18, 0.62)');
        scrim.addColorStop(0.55, 'rgba(8, 8, 18, 0.50)');
        scrim.addColorStop(1, 'rgba(8, 8, 18, 0.32)');
        ctx.fillStyle = scrim;
        ctx.fillRect(0, 0, width, height);
    } else {
        const bg = ctx.createLinearGradient(0, 0, width, height);
        bg.addColorStop(0, '#1a1030');
        bg.addColorStop(0.45, '#24143f');
        bg.addColorStop(1, '#0d1b2a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
    }

    // Left panel
    ctx.fillStyle = 'rgba(10, 10, 20, 0.45)';
    ctx.fillRect(0, 0, 190, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, 0, 190, height);

    // Avatar
    const avatarSize = 110;
    const avatarX = 40;
    const avatarY = 36;
    try {
        const avatar = await loadImage(avatarUrl);
        drawRoundedImage(ctx, avatar, avatarX, avatarY, avatarSize, 22);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 22);
        ctx.stroke();
    } catch {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 22);
        ctx.fill();
    }

    // Member since: below the avatar in the left panel (two lines to fit)
    const memberSince = formatMemberSince(joinedAt);
    if (memberSince) {
        const [label, value] = ['Member since', memberSince.replace('Member since ', '')];
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '17px Arial';
        ctx.fillText(label, (190 - ctx.measureText(label).width) / 2, 190);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 19px Arial';
        ctx.fillText(value, (190 - ctx.measureText(value).width) / 2, 216);
    }

    // Rank (drawn first so the name can shrink around it)
    const rankLabel = rank ? `#${rank}` : '#—';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Arial';
    const rankWidth = ctx.measureText(rankLabel).width;
    ctx.fillText(rankLabel, width - rankWidth - 36, 72);

    // Name line: username only, never overlapping the rank
    const nameMaxWidth = width - 36 - rankWidth - 24 - 220;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.fillText(truncate(ctx, username || 'Unknown', nameMaxWidth), 220, 68);

    // Subtitle: pronouns · title (pronouns take the old title slot)
    const subtitle = buildSubtitle(pronounDisplay, title);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '22px Arial';
    ctx.fillText(truncate(ctx, subtitle, 520), 220, 102);

    // Progress pill
    const barX = 220;
    const barY = 130;
    const barW = 640;
    const barH = 38;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, barX, barY, barW, barH, 19);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    const barLabel = buildProgressPill({ rank, pointsRemaining, nextRank });
    const barLabelWidth = ctx.measureText(barLabel).width;
    ctx.fillText(barLabel, barX + (barW - barLabelWidth) / 2, barY + 25);

    // Activity Score
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '20px Arial';
    ctx.fillText('Activity Score', 220, 205);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    const scoreText = formatNumber(score);
    ctx.fillText(scoreText, width - 36 - ctx.measureText(scoreText).width, 208);

    // Badges: voice time + streak (hide streak when 0)
    const chipY = 235;
    const chips = [`${Number(vcHours || 0).toFixed(1)}h voice time`];
    if (vcStreak > 0) {
        chips.push(`${vcStreak}-day voice streak`);
    }

    let chipX = 220;
    for (const chip of chips) {
        ctx.font = 'bold 18px Arial';
        const chipW = ctx.measureText(chip).width + 28;
        ctx.fillStyle = 'rgba(167, 139, 250, 0.28)';
        roundRect(ctx, chipX, chipY, chipW, 34, 17);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(chip, chipX + 14, chipY + 23);
        chipX += chipW + 12;
    }

    return Buffer.from(await canvas.encode('png'));
}

module.exports = {
    buildProfileCard,
    buildSubtitle,
    buildProgressPill,
    formatMemberSince,
};
