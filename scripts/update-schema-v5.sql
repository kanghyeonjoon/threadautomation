
-- threads_posts 테이블에 'pending' 상태를 처리할 수 있도록 제약 조건 및 컬럼 확인
DO $$ 
BEGIN 
    -- status 컬럼에 'pending'이 들어갈 수 있도록 (이미 가능하겠지만 명시적으로)
    -- 만약 check 제약 조건이 있다면 수정이 필요할 수 있음. 현재는 제약 조건 없음.
    
    -- content_hash 등을 유니크하게 관리했다면 중복 생성을 막기 위해 필요
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='threads_posts' AND column_name='category') THEN
        ALTER TABLE threads_posts ADD COLUMN category TEXT;
    END IF;
END $$;
