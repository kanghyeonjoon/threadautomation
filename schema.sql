-- v4 멀티유저 스키마

-- 1. 유저별 인증 정보
CREATE TABLE IF NOT EXISTS threads_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threads_user_id TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL,
    access_token TEXT NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 콘텐츠 카테고리 (유저별 페르소나 설정)
CREATE TABLE IF NOT EXISTS content_categories (
    id SERIAL PRIMARY KEY,
    threads_user_id TEXT REFERENCES threads_auth(threads_user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    persona TEXT NOT NULL,
    keywords TEXT[], -- 관련 키워드 배열
    is_active BOOLEAN DEFAULT true,
    UNIQUE(threads_user_id, name)
);

-- 3. 포스팅 이력 (유저별 포스트)
CREATE TABLE IF NOT EXISTS threads_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threads_user_id TEXT REFERENCES threads_auth(threads_user_id) ON DELETE CASCADE,
    category TEXT,
    content TEXT NOT NULL,
    content_hash TEXT,
    status TEXT DEFAULT 'pending', -- success, fail, retry
    post_id TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(threads_user_id, content_hash) -- 유저별 본문 중복 방지
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_threads_posts_user_hash ON threads_posts (threads_user_id, content_hash);
