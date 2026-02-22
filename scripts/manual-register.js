
require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

async function manualRegister(shortToken) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        console.log('1. 사용자 정보 조회 중...');
        const userRes = await axios.get(`https://graph.threads.net/me?fields=id,username&access_token=${shortToken}`);
        const { id, username } = userRes.data;
        console.log(`계정 확인: ${username} (${id})`);

        console.log('2. 토큰 유형 확인 및 저장 중...');
        // Meta UI에서 생성된 토큰은 이미 장기 토큰일 확률이 높습니다.
        // 일단 교환을 시도하고, 실패하면 현재 토큰을 그대로 저장합니다.
        let finalToken = shortToken;
        let expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 기본 60일

        try {
            const tokenRes = await axios.get('https://graph.threads.net/access_token', {
                params: {
                    grant_type: 'th_exchange_token',
                    client_secret: process.env.THREADS_APP_SECRET,
                    access_token: shortToken
                }
            });
            finalToken = tokenRes.data.access_token;
            expiresAt = new Date(Date.now() + tokenRes.data.expires_in * 1000).toISOString();
            console.log('장기 토큰 교환 완료.');
        } catch (e) {
            console.log('이미 장기 토큰이거나 교환이 불가능한 토큰입니다. 현재 토큰을 그대로 사용합니다.');
        }

        console.log('3. Supabase에 저장 중...');
        const { error } = await supabase.from('threads_auth').upsert({
            threads_user_id: id,
            nickname: username,
            access_token: finalToken,
            expires_at: expiresAt,
            is_active: true
        });

        if (error) throw error;
        console.log('🎉 등록 성공! 이제 자동 게시 시스템을 사용할 수 있습니다.');

    } catch (err) {
        console.error('❌ 등록 실패:', err.response?.data || err.message);
    }
}

const token = process.argv[2];
if (!token) {
    console.log('토큰을 입력해주세요.');
} else {
    manualRegister(token);
}
