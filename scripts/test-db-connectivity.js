
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectTable() {
    console.log('--- Inspecting threads_posts table ---');

    // 컬럼 정보 조회
    const { data: cols, error: err1 } = await supabase.rpc('get_table_info', { table_name: 'threads_posts' });
    // rpc가 없을 수 있으므로 직접 쿼리 (제한적)

    const { data: recent, error: err2 } = await supabase
        .from('threads_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (err2) console.error('Error fetching recent post:', err2.message);
    else console.log('Most recent record:', recent[0]);

    // 테이블 컬럼 목록 확인 (pg_attribute)
    const { data: columns, error: err3 } = await supabase.from('_columns_query').select('*').catch(() => ({ data: null }));
    // 보통 이렇게는 안되니 그냥 insert 테스트를 해보자

    console.log('Testing raw insert with "system_request"...');
    const { data: ins, error: insErr } = await supabase.from('threads_posts').insert({
        threads_user_id: '24336772846020990',
        content: 'TEST_MANUAL_INSERT',
        status: 'system_request'
    }).select();

    if (insErr) {
        console.error('❌ Insert failed:', insErr.message);
        if (insErr.details) console.error('Details:', insErr.details);
        if (insErr.hint) console.error('Hint:', insErr.hint);
    } else {
        console.log('✅ Insert successful:', ins);
    }
}

inspectTable();
