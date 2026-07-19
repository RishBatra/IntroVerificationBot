const TATSU_BASE = 'https://api.tatsu.gg/v1';

function getApiKey() {
    // Strip quotes/whitespace that hosting panels often add around env values
    const key = (process.env.TATSU_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
    if (!key) {
        throw new Error('TATSU_API_KEY is not set in .env');
    }
    return key;
}

async function tatsuFetch(path) {
    const response = await fetch(`${TATSU_BASE}${path}`, {
        headers: { Authorization: getApiKey() },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        let message = `Tatsu API ${response.status}: ${body || response.statusText}`;
        if (response.status === 401) {
            message =
                'Tatsu API 401 Unauthorized — TATSU_API_KEY is missing, revoked, or invalid. ' +
                'Create a new key with `t!apikey create` and set it in the host env (no quotes).';
        }
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return response.json();
}

async function getUserProfile(userId) {
    return tatsuFetch(`/users/${userId}/profile`);
}

async function getMemberRanking(guildId, userId, period = 'all') {
    return tatsuFetch(`/guilds/${guildId}/rankings/members/${userId}/${period}`);
}

async function getGuildRankings(guildId, period = 'all', offset = 0) {
    return tatsuFetch(`/guilds/${guildId}/rankings/${period}?offset=${offset}`);
}

module.exports = {
    getUserProfile,
    getMemberRanking,
    getGuildRankings,
};
