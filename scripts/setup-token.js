/**
 * 지인(테스터)들이 각자 실행하여 본인의 토큰을 DB에 등록하는 스크립트
 * 1. 앱 승인 URL 생성
 * 2. code 입력 대기
 * 3. code -> short token -> long token 교환
 * 4. DB 저장
 */

require('dotenv').config();
const axios = require('axios');
const readline = require('readline');
const { supabase } = require('../src/supabase');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const APP_ID = process.env.THREADS_APP_ID;
const APP_SECRET = process.env.THREADS_APP_SECRET;
const REDIRECT_URI = 'https://localhost/'; // 앱 설정과 일치해야 함

async function startSetup() {
    console.log('--- 🛡️ Threads Multi-User Setup ---');

    if (!APP_ID || !APP_SECRET) {
        console.error('❌ .env 파일에 THREADS_APP_ID와 THREADS_APP_SECRET을 먼저 설정해 주세요.');
        process.exit(1);
    }

    const authUrl = `https://www.threads.net/oauth/authorize?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&scope=threads_basic,threads_content_publish&response_type=code`;

    console.log('\n1. 아래 URL을 브라우저에 복사하여 접속한 뒤 "승인"을 눌러주세요.');
    console.log(authUrl);

    console.log('\n2. 승인 후 주소창의 ?code= 뒷부분 값(또는 전체 URL)을 여기에 붙여넣어 주세요.');
    rl.question('Code 입력: ', async (input) => {
        try {
            let code = input;
            if (input.includes('code=')) {
                code = input.split('code=')[1].split('#')[0];
            }

            console.log('⏳ 토큰 교환 중...');

            // Step 1: code -> short-lived token
            const shortResponse = await axios.post('https://graph.threads.net/oauth/access_token', {
                client_id: APP_ID,
                client_secret: APP_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                code: code
            });
            const shortToken = shortResponse.data.access_token;
            const userId = shortResponse.data.user_id;

            // Step 2: short -> long-lived token (60 days)
            const longResponse = await axios.get('https://graph.threads.net/access_token', {
                params: {
                    grant_type: 'th_exchange_token',
                    client_secret: APP_SECRET,
                    access_token: shortToken
                }
            });
            const longToken = longResponse.data.access_token;

            // Step 3: Supabase 저장
            rl.question('\n3. 식별용 닉네임을 입력해 주세요 (예: 영희, 철수): ', async (nickname) => {
                const { error } = await supabase
                    .from('threads_auth')
                    .upsert({
                        threads_user_id: userId.toString(),
                        nickname: nickname,
                        access_token: longToken,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'threads_user_id' });

                if (error) throw error;

                console.log(`\n✅ 등록 완료! [${nickname}] 사용자의 토큰이 안전하게 저장되었습니다.`);
                process.exit(0);
            });

        } catch (err) {
            console.error('\n❌ 에러 발생:', err.response?.data || err.message);
            process.exit(1);
        }
    });
}

startSetup();
