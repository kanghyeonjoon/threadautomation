const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getActiveUsers() {
    const { data, error } = await supabase
        .from('threads_auth')
        .select('*')
        .eq('is_active', true);
    if (error) throw error;
    return data;
}

async function getUserCategories(threadsUserId) {
    const { data, error } = await supabase
        .from('content_categories')
        .select('*')
        .eq('threads_user_id', threadsUserId)
        .eq('is_active', true);
    if (error) throw error;
    return data;
}

async function getRecentPostsSummary(threadsUserId, limit = 10) {
    const { data: posts, error } = await supabase
        .from('threads_posts')
        .select('content')
        .eq('threads_user_id', threadsUserId)
        .in('status', ['success', 'pending'])
        .neq('content', 'MANUAL_GENERATION_REQUEST')
        .neq('content', 'REQUEST_GENERATION')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    if (!posts || posts.length === 0) return "No previous posts found.";
    return posts.map(p => p.content).join('\n---\n');
}

async function savePostResult(result) {
    const { error } = await supabase
        .from('threads_posts')
        .insert(result);
    if (error) throw error;
}

async function updateToken(threadsUserId, newToken) {
    const { error } = await supabase
        .from('threads_auth')
        .update({
            access_token: newToken,
            updated_at: new Date().toISOString()
        })
        .eq('threads_user_id', threadsUserId);
    if (error) throw error;
}

module.exports = {
    supabase,
    getActiveUsers,
    getUserCategories,
    getRecentPostsSummary,
    savePostResult,
    updateToken
};
