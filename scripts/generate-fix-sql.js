
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
    console.log('--- Deep Diagnostics ---');

    // 1. 컬럼 목록 확인
    const { data: columns, error: colErr } = await supabase.rpc('inspect_columns', { table_name: 'threads_posts' }).catch(() => ({ data: null }));
    console.log('Columns check:', columns || 'RPC not available');

    // 2. RLS 및 Realtime 상태 (이건 보통 SQL editor에서 봐야 하지만, 간단한 insert 테스트로 권한 확인 가능)
    console.log('Testing "anon" role capability via Service Role (checking RLS)...');

    // 3. 컬럼 'category' 강제 추가 및 Realtime 활성화 SQL 생성
    const sql = `
    -- 1. 컬럼 존재 여부 재확인 및 추가
    ALTER TABLE IF EXISTS threads_posts ADD COLUMN IF NOT EXISTS category TEXT;
    
    -- 2. RLS 활성화 여부 확인 및 모든 권한 허용 (개발 단계이므로)
    ALTER TABLE threads_posts DISABLE ROW LEVEL SECURITY;
    
    -- 3. Realtime 활성화
    BEGIN;
      DROP PUBLICATION IF EXISTS supabase_realtime;
      CREATE PUBLICATION supabase_realtime FOR TABLE threads_posts;
    COMMIT;
  `;

    console.log('Proposed SQL to fix connectivity:\n', sql);
}

diagnose();
