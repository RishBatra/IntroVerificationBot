const activeWindows = new Map();

function buildKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

function getWindow(guildId, userId) {
    return activeWindows.get(buildKey(guildId, userId)) || null;
}

function startWindowUntil(guildId, userId, expiresAtInput, onExpire) {
    const key = buildKey(guildId, userId);
    const existing = activeWindows.get(key);

    if (existing?.timeoutHandle) {
        clearTimeout(existing.timeoutHandle);
    }

    const expiresAt = new Date(expiresAtInput);
    const durationMs = Math.max(0, expiresAt.getTime() - Date.now());

    const timeoutHandle = setTimeout(async () => {
        try {
            await onExpire({ guildId, userId, expiresAt });
        } finally {
            const current = activeWindows.get(key);
            if (current && current.expiresAt.getTime() === expiresAt.getTime()) {
                activeWindows.delete(key);
            }
        }
    }, durationMs);

    activeWindows.set(key, {
        guildId,
        userId,
        expiresAt,
        timeoutHandle
    });

    return { expiresAt, replaced: Boolean(existing) };
}

function startWindow(guildId, userId, durationMs, onExpire) {
    const expiresAt = new Date(Date.now() + durationMs);
    return startWindowUntil(guildId, userId, expiresAt, onExpire);
}

function endWindow(guildId, userId) {
    const key = buildKey(guildId, userId);
    const existing = activeWindows.get(key);

    if (!existing) {
        return false;
    }

    if (existing.timeoutHandle) {
        clearTimeout(existing.timeoutHandle);
    }

    activeWindows.delete(key);
    return true;
}

module.exports = {
    getWindow,
    startWindow,
    startWindowUntil,
    endWindow
};
