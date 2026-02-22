const crypto = require('crypto');
const {
    getActiveUsers,
    getUserCategories,
    getRecentPostsSummary,
    savePostResult
} = require('./supabase');
const { generateContent } = require('./claude');
const threadsApi = require('./threads');
const { sendDiscordNotification } = require('./discord');

async function runAutoPosting() {
    console.log('🚀 Starting Multi-User Auto Posting Workflow...');

    try {
        const users = await getActiveUsers();
        console.log(`Found ${users.length} active users.`);

        for (const user of users) {
            console.log(`\n--- Processing User: ${user.nickname} (${user.threads_user_id}) ---`);

            try {
                // 1. 카테고리 선정 (랜덤 혹은 순환 - 여기선 랜덤)
                const categories = await getUserCategories(user.threads_user_id);
                if (categories.length === 0) {
                    console.warn(`No active categories for ${user.nickname}. Skipping.`);
                    continue;
                }
                const selectedCategory = categories[Math.floor(Math.random() * categories.length)];

                // 2. 최근 포스트 요약 가져오기
                const recentSummary = await getRecentPostsSummary(user.threads_user_id);

                // 3. 콘텐츠 생성
                console.log(`Generating content for category: ${selectedCategory.name}...`);
                const content = await generateContent({
                    persona: selectedCategory.persona,
                    category: selectedCategory.name,
                    keywords: selectedCategory.keywords || [],
                    recentSummary,
                    nickname: user.nickname
                });

                // 4. 중복 체크용 해시
                const contentHash = crypto.createHash('sha256').update(content).digest('hex');

                // 5. Threads 발행 대신 '점검 대기(pending)' 상태로 저장
                console.log('Sending to Dashboard for verification...');

                // 6. DB 저장 (pending 상태로)
                await savePostResult({
                    threads_user_id: user.threads_user_id,
                    content,
                    status: 'pending' // 게시 전 대기 상태
                });

                // 7. 알림
                await sendDiscordNotification(`⏳ **[${user.nickname}]** 새 게시물이 생성되었습니다. 대시보드에서 승인해 주세요!\n내용: ${content.substring(0, 50)}...`);
                console.log(`Content pending review for ${user.nickname}.`);

            } catch (userError) {
                console.error(`Error for user ${user.nickname}:`, userError.message);
                await savePostResult({
                    threads_user_id: user.threads_user_id,
                    content: 'FAILED',
                    status: 'fail',
                    error_message: userError.message
                });
                await sendDiscordNotification(`❌ **[${user.nickname}]** 포스팅 실패: ${userError.message}`);
            }
        }

    } catch (globalError) {
        console.error('Global Execution Error:', globalError.message);
        await sendDiscordNotification(`🚨 **Global Error**: ${globalError.message}`);
    }
}

// GitHub Actions 환경에서 실행될 때 직접 호출
if (require.main === module) {
    runAutoPosting();
}
