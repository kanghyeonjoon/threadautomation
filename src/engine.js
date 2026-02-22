
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { generateContent } = require('./claude');
const threadsApi = require('./threads');
const { getActiveUsers, getUserCategories, getRecentPostsSummary } = require('./supabase');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const processingIds = new Set();

async function processRequests() {
    try {
        // 1. 점검 요청(system_request) 처리
        const { data: requests } = await supabase.from('threads_posts')
            .select('*')
            .eq('status', 'system_request');

        for (const req of (requests || [])) {
            if (processingIds.has(req.id)) continue;
            processingIds.add(req.id);

            console.log(`✨ Processing Generation Request for user: ${req.user_id}`);
            try {
                // 특정 유저의 페르소나와 계정 정보 로드
                const { data: userAuth } = await supabase.from('threads_auth').select('*').eq('threads_user_id', req.threads_user_id).single();
                const { data: categories } = await supabase.from('content_categories').select('*').eq('threads_user_id', req.threads_user_id).eq('is_active', true);

                if (!userAuth || !categories || categories.length === 0) {
                    throw new Error('User settings not found for generation');
                }

                const category = categories[0];
                const summary = await getRecentPostsSummary(req.threads_user_id);

                const content = await generateContent({
                    persona: category.persona,
                    category: category.name,
                    keywords: category.keywords || [],
                    recentSummary: summary,
                    nickname: userAuth.nickname
                });

                await supabase.from('threads_posts')
                    .update({ content, status: 'pending', category: category.name })
                    .eq('id', req.id);

                console.log(`✅ Generation Success -> Pending: ${req.id}`);
            } catch (err) {
                console.error(`❌ Error in req ${req.id}:`, err.message);
                await supabase.from('threads_posts').update({ status: 'fail', error_message: err.message }).eq('id', req.id);
            } finally {
                processingIds.delete(req.id);
            }
        }

        // 2. 승인 완료(approved) 게시
        const { data: approved } = await supabase.from('threads_posts')
            .select('*')
            .eq('status', 'approved');

        for (const post of (approved || [])) {
            if (processingIds.has(post.id)) continue;
            processingIds.add(post.id);

            console.log(`🚀 Publishing Approved Post: ${post.id}`);
            try {
                const { data: user } = await supabase.from('threads_auth')
                    .select('*')
                    .eq('threads_user_id', post.threads_user_id)
                    .single();

                await new Promise(r => setTimeout(r, 5000));
                const postId = await threadsApi.publishPost(user.threads_user_id, post.content, user.access_token);

                await supabase.from('threads_posts').update({ status: 'success', post_id: postId }).eq('id', post.id);
                console.log(`✅ Publish Success: ${post.id}`);
            } catch (err) {
                console.error(`❌ Error in post ${post.id}:`, err.message);
                await supabase.from('threads_posts').update({ status: 'fail', error_message: err.message }).eq('id', post.id);
            } finally {
                processingIds.delete(post.id);
            }
        }
    } catch (err) {
        console.error('Error in processing loop:', err.message);
    }
}

async function startServer() {
    process.on('unhandledRejection', (reason, p) => {
        console.error('Unhandled Rejection at:', p, 'reason:', reason);
    });

    console.log('💎 Money Medic Backend Engine Running (Robust Mode)...');

    // 리얼타임 보조
    supabase.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'threads_posts' }, () => {
        processRequests();
    }).subscribe();

    // 5초마다 폴링
    setInterval(processRequests, 5000);
    processRequests();
}

startServer();
