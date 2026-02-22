const axios = require('axios');

const threadsApi = {
    async refreshToken(token) {
        try {
            const response = await axios.get('https://graph.threads.net/refresh_access_token', {
                params: {
                    grant_type: 'th_refresh_token',
                    access_token: token
                }
            });
            return response.data;
        } catch (err) {
            console.error('Threads API Refresh Error:', err.response?.data || err.message);
            throw err;
        }
    },

    async createContainer(userId, text, token) {
        try {
            const response = await axios.post(`https://graph.threads.net/v1.0/${userId}/threads`, {
                media_type: 'TEXT',
                text: text,
                access_token: token
            });
            return response.data.id;
        } catch (err) {
            console.error('Threads API Container Error:', err.response?.data || err.message);
            throw err;
        }
    },

    async publishContainer(userId, containerId, token) {
        try {
            const response = await axios.post(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
                creation_id: containerId,
                access_token: token
            });
            return response.data.id;
        } catch (err) {
            console.error('Threads API Publish Error:', err.response?.data || err.message);
            throw err;
        }
    },

    async publishPost(userId, text, token) {
        const containerId = await this.createContainer(userId, text, token);
        console.log(`Container created: ${containerId}. Waiting 5s before publishing...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
        return await this.publishContainer(userId, containerId, token);
    }
};

module.exports = threadsApi;
