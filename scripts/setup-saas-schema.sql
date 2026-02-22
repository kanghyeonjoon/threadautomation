
-- SaaS 전환을 위한 멀티 유저 보안 스키마 업데이트

-- 1. threads_auth 테이블에 Supabase Auth 연동 (user_id 추가)
ALTER TABLE threads_auth ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. RLS(Row Level Security) 활성화
ALTER TABLE threads_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads_posts ENABLE ROW LEVEL SECURITY;

-- 3. 유저별 데이터 접근 정책(Policy) 설정

-- [threads_auth] 본인의 계정 연동 정보만 조회/수정 가능
DROP POLICY IF EXISTS "Users can manage their own threads auth" ON threads_auth;
CREATE POLICY "Users can manage their own threads auth" ON threads_auth
    FOR ALL USING (auth.uid() = user_id);

-- [content_categories] 본인의 페르소나 설정만 조회/수정 가능
-- threads_auth를 거쳐서 user_id를 확인하거나 직접 content_categories에 user_id를 추가하는 것이 성과가 좋습니다.
-- 편의상 content_categories에도 user_id를 추가합니다.
ALTER TABLE content_categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
DROP POLICY IF EXISTS "Users can manage their own categories" ON content_categories;
CREATE POLICY "Users can manage their own categories" ON content_categories
    FOR ALL USING (auth.uid() = user_id);

-- [threads_posts] 본인의 게시물 이력만 조회/수정 가능
ALTER TABLE threads_posts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
DROP POLICY IF EXISTS "Users can manage their own posts" ON threads_posts;
CREATE POLICY "Users can manage their own posts" ON threads_posts
    FOR ALL USING (auth.uid() = user_id);

-- 4. 서비스 역할(엔진)을 위한 예외 정책
-- 백엔드 엔진(service_role)은 모든 데이터를 볼 수 있어야 하므로 RLS가 기본적으로 우회되지만 명시적으로 관리하기 위함
