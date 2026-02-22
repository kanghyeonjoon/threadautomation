const cron = require('node-cron');
const crypto = require('crypto');
const { supabase, anthropic, sendNotification, threadsApi } = require('./utils');

/**
 * 1. 워크플로우 A: 토큰 생명 연장 시스템
 * 매월 1일 00:00 실행
 */
async function maintenanceTask() {
    console.log('[Maintenance] Starting token refresh task...');
    try {
        const { data: auths, error } = await supabase
            .from('threads_auth')
            .select('*');

        if (error) throw error;

        for (const auth of auths) {
            const newTokenData = await threadsApi.refreshToken(auth.access_token);

            await supabase
                .from('threads_auth')
                .update({
                    access_token: newTokenData.access_token,
                    updated_at: new Date().toISOString()
                })
                .eq('threads_user_id', auth.threads_user_id);

            console.log(`[Maintenance] Token refreshed for ${auth.threads_user_id}`);
        }
        await sendNotification('✅ [Maintenance] All Threads tokens have been successfully refreshed.');
    } catch (error) {
        console.error('[Maintenance] Error:', error.message);
        await sendNotification(`❌ [Maintenance] Token refresh failed: ${error.message}`);
    }
}

/**
 * 2. 워크플로우 B: Claude 기반 자동 포스팅
 * 매시간 정각 실행
 */
async function autoPostTask() {
    console.log('[Execution] Starting auto posting task...');
    try {
        // 토큰 및 ID 확보
        const { data: auth, error: authError } = await supabase
            .from('threads_auth')
            .select('*')
            .single();

        if (authError || !auth) throw new Error('Failed to fetch auth data from Supabase');

        // 콘텐츠 생성 (Claude)
        const topic = "오늘의 한 줄 생각"; // 주제는 추후 확충 가능
        const prompt = `당신은 스레드 유저입니다. 초등학생 수준의 쉬운 어휘를 사용하고, 절대로 문장 끝에 마침표를 찍지 마세요. 주제: ${topic}`;

        const msg = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 1000,
            temperature: 0.7,
            messages: [{ role: "user", content: prompt }],
        });

        const content = msg.content[0].text;
        const contentHash = crypto.createHash('md5').update(content).digest('hex');

        // 중복 체크
        const { data: existingPost } = await supabase
            .from('threads_posts')
            .select('id')
            .eq('content_hash', contentHash)
            .limit(1)
            .single();

        if (existingPost) {
            console.log('[Execution] Skipping duplicate content.');
            return;
        }

        // Threads API 발행 (2단계)
        console.log('[Execution] Creating container...');
        const creationId = await threadsApi.createContainer(auth.threads_user_id, content, auth.access_token);

        console.log('[Execution] Publishing post...');
        const postId = await threadsApi.publishPost(auth.threads_user_id, creationId, auth.access_token);

        // 결과 기록
        await supabase.from('threads_posts').insert({
            content,
            content_hash: contentHash,
            status: 'success',
            post_id: postId
        });

        console.log(`[Execution] Post successful! ID: ${postId}`);
        // await sendNotification(`🚀 [Execution] New post published: ${content}`);

    } catch (error) {
        console.error('[Execution] Error:', error.message);
        await sendNotification(`❌ [Execution] Auto posting failed: ${error.message}`);

        // 에러 상태 기록
        await supabase.from('threads_posts').insert({
            content: 'FAILED_GENERATION',
            status: 'fail',
            error_message: error.message
        });
    }
}

// --- 스케줄링 설정 ---

// 1. 매월 1일 00:00 토큰 갱신
cron.schedule('0 0 1 * *', maintenanceTask);

// 2. 매시간 정각 자동 포스팅
cron.schedule('0 * * * *', autoPostTask);

console.log('--- Threads Automation Engine Started ---');
console.log('Maintenance: 1st of every month');
console.log('Execution: Every hour');

// 초동 실행 테스트를 원하시면 아래 주석을 해제하세요
// autoPostTask();
