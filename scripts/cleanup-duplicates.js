
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    console.log('--- Cleaning up duplicate pending/system_request posts ---');

    // 1. 중복된 pending 데이터 삭제 (최신 1개만 남기기 위해 높은 ID 우선)
    const { data: posts } = await supabase.from('threads_posts')
        .select('id')
        .or('status.eq.pending,status.eq.system_request')
        .order('id', { ascending: false });

    if (posts && posts.length > 1) {
        const idsToDelete = posts.slice(1).map(p => p.id);
        console.log('Deleting redundant IDs:', idsToDelete);
        await supabase.from('threads_posts').delete().in('id', idsToDelete);
    }

    console.log('✅ Cleanup complete.');
}
cleanup();
