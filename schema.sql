-- v4 멀티유저 스키마

-- 1. 유저별 인증 정보
CREATE TABLE IF NOT EXISTS threads_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL, -- Supabase Auth User ID
    threads_user_id TEXT UNIQUE NOT NULL, -- Meta Threads ID
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
    user_id UUID UNIQUE NOT NULL, -- 1유저 1페르소나 구조 (upsert용)
    threads_user_id TEXT REFERENCES threads_auth(threads_user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    persona TEXT NOT NULL,
    keywords TEXT[],
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id)
);

-- 3. 포스팅 이력 (유저별 포스트)
CREATE TABLE IF NOT EXISTS threads_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Supabase Auth User ID
    threads_user_id TEXT REFERENCES threads_auth(threads_user_id) ON DELETE CASCADE,
    category TEXT,
    content TEXT NOT NULL,
    content_hash TEXT,
    status TEXT DEFAULT 'pending',
    post_id TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, content_hash)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_threads_posts_user_hash ON threads_posts (threads_user_id, content_hash);
