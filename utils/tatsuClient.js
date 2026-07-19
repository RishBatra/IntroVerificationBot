const TATSU_BASE = 'https://api.tatsu.gg/v1';

function getApiKey() {
    const key = process.env.TATSU_API_KEY;
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
        const error = new Error(`Tatsu API ${response.status}: ${body || response.statusText}`);
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

module.exports = {
    getUserProfile,
    getMemberRanking,
};
