
// Money Medic Dashboard Core Logic
const SUPABASE_URL = 'https://kyicedypelnrnctkvicq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GYfuzyBClnj4jHILADklcg_wsxlt2ZV';

// Supabase 클라이언트 초기화
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 앱 상태 관리
let currentUser = null;
let pendingPosts = [];
let currentEditingId = null;

// 실시간 상태 표시를 위한 함수
function updateSystemStatus(text, color) {
    const statusText = document.querySelector('.bot-status span');
    const indicator = document.querySelector('.status-indicator');
    if (statusText) statusText.innerText = text;
    if (indicator) {
        indicator.style.background = color;
        indicator.style.boxShadow = `0 0 10px ${color}`;
    }
}

// 초기화 함수
async function init() {
    console.log('💎 Money Medic Dashboard Initializing...');

    // 1. 인증 확인
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;
    document.getElementById('user-email').innerText = currentUser.email;

    // 네비게이션 효과
    setupNavigation();

    updateSystemStatus('Connecting to DB...', 'orange');
    try {
        await Promise.all([
            fetchStats(),
            fetchPendingPosts(),
            fetchRecentLogs()
        ]);
        setupRealtime();
        updateSystemStatus('System Online (Synced)', '#00ff88');
    } catch (err) {
        console.error('Initialization failed:', err);
        updateSystemStatus('DB Connection Error', 'red');
    }
}

// 사이드바 네비게이션
function setupNavigation() {
    const navItems = document.querySelectorAll('nav li');
    navItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            // <a> 태그의 기본 동작(해시 이동) 방지
            e.preventDefault();

            const pageName = item.innerText.trim();
            console.log('💎 Navigating to:', pageName);

            // 기존 탭 활성화 클래스 처리
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // 페이지/모달 전환 로직
            if (pageName === 'Persona Settings') {
                await openSettingsModal();
            } else if (pageName === 'Log History') {
                showLogHistoryPage();
            } else {
                showDashboardPage();
            }
        });
    });

    document.getElementById('logout-btn').onclick = async () => {
        await db.auth.signOut();
        window.location.href = 'login.html';
    };
}

// 페이지 전환 관련 UI 헬퍼
function showDashboardPage() {
    // 실제 섹션 가시성 제어 (나중에 확장 가능)
    console.log('Displaying Dashboard');
}

function showLogHistoryPage() {
    console.log('Displaying Log History');
}

// 설정 모달 열기 및 기존 데이터 로드
async function openSettingsModal() {
    updateSystemStatus('Loading Settings...', 'cyan');

    // 1. Threads 계정 정보 가져오기
    const { data: authData } = await db.from('threads_auth').select('*').eq('user_id', currentUser.id).maybeSingle();
    if (authData) {
        document.getElementById('setting-threads-id').value = authData.threads_user_id || '';
        document.getElementById('setting-access-token').value = authData.access_token || '';
    }

    // 2. 페르소나 정보 가져오기
    const { data: catData } = await db.from('content_categories').select('*').eq('user_id', currentUser.id).maybeSingle();
    if (catData) {
        document.getElementById('setting-persona-name').value = catData.name || '';
        document.getElementById('setting-persona-desc').value = catData.persona || '';
    }

    document.getElementById('settings-modal').style.display = 'flex';
}

// 통계 데이터 조회 (본인 데이터만)
async function fetchStats() {
    const { count, error } = await db.from('threads_posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);

    if (error) console.error('fetchStats error:', error);
    else document.getElementById('total-posts').innerText = count || 0;
}

// 점검 대기 게시물 조회 (status = pending, 본인 데이터만)
async function fetchPendingPosts() {
    const { data, error } = await db
        .from('threads_posts')
        .select('*')
        .eq('status', 'pending')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('fetchPendingPosts error:', error);
        document.getElementById('pending-container').innerHTML = `<div style="color:red; font-size:12px;">데이터를 불러올 수 없습니다.</div>`;
        return;
    }
    pendingPosts = data || [];
    renderPending();
}

// 최근 활동 로그 조회 (본인 데이터만)
async function fetchRecentLogs() {
    const { data, error } = await db
        .from('threads_posts')
        .select('*')
        .neq('status', 'pending')
        .neq('status', 'system_request')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('fetchRecentLogs error:', error);
        document.getElementById('log-container').innerHTML = `<div style="color:red; font-size:12px;">활동 로그 로드 실패</div>`;
        return;
    }
    renderLogs(data || []);
}

// 리얼타임 DB 구독 설정 (본인 데이터만 필터링)
function setupRealtime() {
    db
        .channel('db-changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'threads_posts',
            filter: `user_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('🔔 DB Event:', payload.eventType);
            fetchStats();
            fetchPendingPosts();
            fetchRecentLogs();
        })
        .subscribe();
}

// 화면 렌더링: 점검 대기 목록
function renderPending() {
    const container = document.getElementById('pending-container');
    if (pendingPosts.length === 0) {
        container.innerHTML = '<div class="empty-state">승인 대기 중인 게시물이 없습니다.</div>';
        return;
    }

    container.innerHTML = pendingPosts.map(post => `
        <div class="pending-item" style="border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; margin-bottom: 15px; background: rgba(255,255,255,0.02);">
            <div class="pending-header" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span class="category-tag" style="background: rgba(138, 43, 226, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px;">${post.category || '인공지능'}</span>
                <span class="time" style="color: #666; font-size: 11px;">${new Date(post.created_at).toLocaleTimeString()}</span>
            </div>
            <div class="pending-content" style="line-height: 1.6; margin-bottom: 15px; white-space: pre-wrap;">${post.content}</div>
            <div class="pending-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
                <button onclick="window.deletePost('${post.id}')" class="btn" style="background: rgba(255, 68, 68, 0.1); color: #ff4444; border: 1px solid rgba(255, 68, 68, 0.2);">삭제</button>
                <button onclick="window.openEditModal('${post.id}')" class="btn secondary">수정</button>
                <button onclick="window.approvePost('${post.id}')" class="btn primary">승인 및 게시</button>
            </div>
        </div>
    `).join('');
}

// 화면 렌더링: 로그 이력
function renderLogs(logs) {
    const container = document.getElementById('log-container');
    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state">최근 활동이 없습니다.</div>';
        return;
    }
    container.innerHTML = logs.map(log => `
        <div class="log-item" style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.1);">
            <div class="status-indicator ${log.status}" style="width: 8px; height: 8px; border-radius: 50%; background: ${log.status === 'success' ? '#00ff88' : '#ff4444'};"></div>
            <div style="flex: 1;">
                <p style="font-size: 13px; color: #ccc;">${log.content.substring(0, 40)}...</p>
                <span style="font-size: 11px; color: #555;">${new Date(log.created_at).toLocaleString()}</span>
            </div>
        </div>
    `).join('');
}

// --- 글로벌 액션 함수 ---

window.approvePost = async (id) => {
    updateSystemStatus('Publishing...', 'yellow');
    const { error } = await db.from('threads_posts').update({ status: 'approved' }).eq('id', id);
    if (error) alert('승인 실패: ' + error.message);
};

window.openEditModal = (id) => {
    const post = pendingPosts.find(p => p.id === id);
    if (!post) return;
    currentEditingId = id;
    document.getElementById('edit-content').value = post.content;
    document.getElementById('approve-modal').style.display = 'flex';
};

window.deletePost = async (id) => {
    if (!confirm('정말 삭제하시겠습니까? 승인 전인 게시물만 삭제 가능합니다.')) return;

    updateSystemStatus('Deleting Post...', 'orange');
    const { error } = await db.from('threads_posts').delete().eq('id', id);
    if (error) {
        alert('삭제 실패: ' + error.message);
        updateSystemStatus('Delete Error', 'red');
    } else {
        updateSystemStatus('Post Deleted', '#00ff88');
    }
};

document.getElementById('cancel-btn').onclick = () => document.getElementById('approve-modal').style.display = 'none';

document.getElementById('final-publish-btn').onclick = async () => {
    const newContent = document.getElementById('edit-content').value;
    const { error } = await db.from('threads_posts').update({
        content: newContent,
        status: 'approved'
    }).eq('id', currentEditingId);

    if (error) alert('게시 실패: ' + error.message);
    else document.getElementById('approve-modal').style.display = 'none';
};

document.getElementById('generate-btn').onclick = async () => {
    const btn = document.getElementById('generate-btn');
    const originalText = btn.innerText;

    if (!confirm('새로운 스레드 글을 생성하시겠습니까? (AI가 즉시 작성을 시작합니다)')) return;

    btn.innerText = 'Generating...';
    btn.disabled = true;
    updateSystemStatus('Generating...', 'cyan');

    // 1. 해당 유저의 쓰레드 계정 ID 가져오기 (임시로 첫번째 계정 사용)
    const { data: auths } = await db.from('threads_auth').select('threads_user_id').eq('user_id', currentUser.id);

    if (!auths || auths.length === 0) {
        alert('쓰레드 계정이 연동되어 있지 않습니다. 설정에서 계정을 먼저 연결해주세요!');
        btn.innerText = originalText;
        btn.disabled = false;
        return;
    }

    const { error } = await db.from('threads_posts').insert({
        threads_user_id: auths[0].threads_user_id,
        user_id: currentUser.id,
        content: 'MANUAL_GENERATION_REQUEST',
        status: 'system_request'
    });

    if (error) {
        console.error('Generation request failed:', error);
        alert('요청 실패 (보안 정책 확인): ' + error.message);
        updateSystemStatus('Error', 'red');
        btn.innerText = originalText;
        btn.disabled = false;
    } else {
        setTimeout(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        }, 3000);
    }
};

document.getElementById('close-settings-btn').onclick = () => document.getElementById('settings-modal').style.display = 'none';

document.getElementById('save-settings-btn').onclick = async () => {
    const threadsId = document.getElementById('setting-threads-id').value;
    const token = document.getElementById('setting-access-token').value;
    const personaName = document.getElementById('setting-persona-name').value;
    const personaDesc = document.getElementById('setting-persona-desc').value;

    if (!threadsId || !token || !personaName || !personaDesc) {
        alert('모든 항목을 입력해주세요.');
        return;
    }

    const btn = document.getElementById('save-settings-btn');
    btn.innerText = 'Saving...';
    btn.disabled = true;

    try {
        // 1. threads_auth 저장 (upsert)
        const { error: authErr } = await db.from('threads_auth').upsert({
            threads_user_id: threadsId,
            user_id: currentUser.id,
            nickname: currentUser.email.split('@')[0],
            access_token: token,
            is_active: true,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' }); // user_id 기준 중복 시 업데이트

        if (authErr) throw authErr;

        // 2. content_categories 저장 (upsert)
        const { error: catErr } = await db.from('content_categories').upsert({
            threads_user_id: threadsId,
            user_id: currentUser.id,
            name: personaName,
            persona: personaDesc,
            is_active: true
        }, { onConflict: 'user_id' });

        if (catErr) throw catErr;

        alert('설정이 저장되었습니다! 이제 통찰을 생성할 수 있습니다.');
        document.getElementById('settings-modal').style.display = 'none';
        init(); // 새로고침
    } catch (err) {
        console.error('Settings save failed:', err);
        alert('저장 실패: ' + err.message);
    } finally {
        btn.innerText = 'Save & Connect';
        btn.disabled = false;
    }
};

init();
