require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

// 1. Supabase Client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 2. Anthropic (Claude) Client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// 3. Notification Helper (Discord)
async function sendNotification(message) {
    if (!process.env.DISCORD_WEBHOOK_URL) return;
    try {
        await axios.post(process.env.DISCORD_WEBHOOK_URL, { content: message });
    } catch (error) {
        console.error('Failed to send notification:', error.message);
    }
}

// 4. Threads API Wrappers
const threadsApi = {
    async refreshToken(token) {
        const response = await axios.get('https://graph.threads.net/refresh_access_token', {
            params: {
                grant_type: 'fb_extend_access_token',
                access_token: token
            }
        });
        return response.data;
    },

    async createContainer(userId, text, token) {
        const response = await axios.post(`https://graph.threads.net/v1.0/${userId}/threads`, {
            media_type: 'TEXT',
            text: text,
            access_token: token
        });
        return response.data.id;
    },

    async publishPost(userId, creationId, token) {
        const response = await axios.post(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
            creation_id: creationId,
            access_token: token
        });
        return response.data.id;
    }
};

module.exports = { supabase, anthropic, sendNotification, threadsApi };
