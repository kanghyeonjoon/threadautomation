
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function purge() {
    console.log('--- Purging bad data ---');

    // 성공하지 않은 게시물 중 중복되거나 의미 없는 것 제거
    const { error } = await supabase.from('threads_posts')
        .delete()
        .neq('status', 'success');

    if (error) console.error(error);
    else console.log('✅ Purged all non-success posts for a fresh start.');
}
purge();
