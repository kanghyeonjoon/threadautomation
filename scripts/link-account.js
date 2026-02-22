
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function linkAccount(email, threadsUserId) {
    // 1. Auth 유저 찾기
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        console.log('❌ 유저를 찾을 수 없습니다.');
        return;
    }

    console.log(`🔗 Linking [${email}] (ID: ${user.id}) to Threads Account...`);

    // 2. threads_auth 테이블 업데이트
    const { error: authErr } = await supabase.from('threads_auth')
        .update({ user_id: user.id })
        .eq('threads_user_id', threadsUserId);

    if (authErr) console.error('Error linking threads_auth:', authErr);

    // 3. content_categories 테이블 업데이트
    const { error: catErr } = await supabase.from('content_categories')
        .update({ user_id: user.id })
        .eq('threads_user_id', threadsUserId);

    if (catErr) console.error('Error linking categories:', catErr);

    // 4. threads_posts 테이블 업데이트 (옵션: 기존 게시물도 보게 함)
    const { error: postErr } = await supabase.from('threads_posts')
        .update({ user_id: user.id })
        .eq('threads_user_id', threadsUserId);

    if (postErr) console.error('Error linking posts:', postErr);

    console.log('✅ 계정 연동 및 데이터 이관 완료!');
}

// 기존에 사용하던 Threads User ID (24336772846020990)를 새 유저에게 연결
linkAccount('dkwk302@naver.com', '24336772846020990');
