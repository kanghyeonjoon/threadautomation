# 스레드 자동화 시스템 설계서 (v4)

## 1. 프로젝트 개요

Claude AI를 활용하여 고품질의 Threads 콘텐츠를 자동 생성하고, Meta Threads API를 통해 정기적으로 발행하는 **소규모 멀티유저 자동화 시스템**.

> **사용 범위**: 본인 + 소수 지인 (2~5명)이 각자의 Threads 계정으로 사용
> **운영 방식**: 하나의 시스템이 등록된 모든 유저의 계정을 순회하며 자동 포스팅

---

## 2. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                   GitHub Actions (Cron)              │
│              스케줄러 & 실행 환경 (무료)               │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
     ┌─────▼─────┐            ┌──────▼──────┐
     │ 토큰 갱신  │            │ 콘텐츠 생성  │
     │ (월 1회)   │            │ & 발행       │
     └─────┬─────┘            └──────┬──────┘
           │                          │
     ┌─────▼──────────────────────────▼───────┐
     │              Supabase                   │
     │  (유저별 토큰 / 포스팅 이력 / 주제 관리)    │
     └─────────────────┬──────────────────────┘
                       │
              ┌────────▼────────┐
              │  Threads API    │
              │  (Meta Graph)   │
              └─────────────────┘
```

### 기술 스택
| 구성요소 | 기술 | 선택 이유 |
| :--- | :--- | :--- |
| 런타임 | Node.js 20+ | Threads SDK 호환, 생태계 |
| 스케줄러 | GitHub Actions Cron | 무료, 서버 불필요, yml로 관리 |
| AI 엔진 | Claude Sonnet 4.5 | 비용 효율 + 고품질 텍스트 생성 |
| DB | Supabase (PostgreSQL) | 무료 티어, REST API 내장 |
| 알림 | Discord Webhook | 무료, 간편 설정 |

---

## 3. 인증 시스템

### 3-1. 최초 토큰 획득 (유저별 1회, 수동)
> Threads API는 OAuth 2.0 기반이므로, **각 유저가 1회 수동 인증**이 필요합니다.

**관리자(본인)가 할 일:**
1. Meta Developer 앱 1개 생성 및 Threads API 권한 설정
2. 앱에 지인들의 Meta 계정을 **테스터로 추가**

**각 유저(지인)가 할 일:**
1. 관리자가 제공한 `setup-token.js` 스크립트 실행
2. 브라우저에서 OAuth 인증 URL 자동 열림 → 본인 Threads 계정 승인
3. 콜백으로 받은 `authorization_code` → 단기 토큰 → **장기 토큰(60일)** 자동 교환
4. 장기 토큰이 Supabase `threads_auth` 테이블에 자동 저장

> **핵심**: Meta Developer 앱은 1개만 있으면 됩니다. 지인들은 해당 앱의 테스터로 등록되어 각자 OAuth 인증만 하면 됩니다.

### 3-2. 토큰 자동 갱신 (월 1회, 자동 — 전체 유저 대상)
- **주기**: 매월 1일 00:00 UTC
- **과정**:
  1. Supabase에서 **모든 유저의** `access_token` 조회
  2. 유저별로 순회하며 `GET /refresh_access_token?grant_type=th_refresh_token&access_token={token}` 호출
  3. 각 유저의 새 토큰을 Supabase에 업데이트
  4. 유저별 성공/실패 Discord 알림 전송

---

## 4. 콘텐츠 생성 & 발행 파이프라인

### 4-1. 발행 스케줄
- **빈도**: 하루 **3~4회** (08:00, 12:00, 18:00, 21:00 KST)
- **이유**: Threads Rate Limit(24시간 25포스트) 준수 + 스팸 방지 + 최적 시간대 공략

#### [회의 합의 #3] 시간대별 콘텐츠 톤 차별화
| 시간 | 톤 | 콘텐츠 성격 |
| :--- | :--- | :--- |
| 08:00 | 가볍고 짧게 | 한줄 인사이트, 아침 동기부여, 가벼운 질문 |
| 12:00 | 정보성 | 팁, 추천, 트렌드 요약 |
| 18:00 | 인사이트 | 깊은 생각, 경험 기반 이야기 |
| 21:00 | 공감/감성 | 하루 마무리, 공감글, 편한 대화체 |

### 4-2. 콘텐츠 생성 (Claude API)

#### 프롬프트 설계
```
[시스템 프롬프트]
- 페르소나: {persona} (예: IT 트렌드 큐레이터, 자기계발 코치 등)
- 톤앤매너: 친근하고 캐주얼하지만 인사이트 있는 글
- 글자 수: 100~450자 (Threads 최대 500자)
- 해시태그: 0~2개 최소한으로 (Threads는 텍스트 매력이 핵심)
- 인터랙션 유도: 질문형 마무리, 의견을 묻는 형태, 공감 유도 등 답글을 이끄는 구조
- 금지사항: 광고성 표현, 허위 정보, 민감한 정치/종교 주제

[사용자 프롬프트]
- 주제 카테고리: {category}
- 참고 키워드: {keywords}
- 최근 발행 내용 요약: {recent_posts_summary} (중복 방지용)
- 현재 유저: {user_nickname} (유저별 톤 차별화 가능)
```

#### 콘텐츠 카테고리 (유저별 1~2개 선택, 순환 발행)
| ID | 카테고리 | 예시 |
| :--- | :--- | :--- |
| 1 | 기술/IT 트렌드 | AI 신기능, 개발 팁, 앱 추천 |
| 2 | 생산성/자기계발 | 습관 만들기, 시간 관리, 독서 |
| 3 | 인사이트/생각 | 일상 관찰, 짧은 에세이 |
| 4 | 유머/공감 | 밈, 공감 글, 가벼운 이야기 |

> **[회의 합의 #1]** 한 계정에 4개 카테고리를 전부 돌리지 않는다. **유저당 1~2개만 선택**하여 계정 정체성을 유지한다.

### 4-3. 발행 프로세스 (2단계 API 호출)

```
Step 1: 미디어 컨테이너 생성
POST /{user_id}/threads
Body: { media_type: "TEXT", text: "{생성된 콘텐츠}" }
→ creation_id 획득

Step 2: 실제 발행
POST /{user_id}/threads_publish
Body: { creation_id: "{creation_id}" }
→ post_id 획득

Step 3: 결과 기록
→ Supabase threads_posts 테이블에 저장
```

### 4-4. 중복 방지 로직
1. 콘텐츠 생성 전: 최근 20개 포스트 요약을 Claude 프롬프트에 포함
2. 콘텐츠 생성 후: SHA-256 해시 생성 → DB 중복 체크
3. 유사도 체크: 직전 5개 포스트와 비교하여 너무 유사하면 재생성 (최대 3회 재시도)

---

## 5. 데이터베이스 설계 (Supabase)

### `threads_auth` 테이블 (유저별 인증 정보)
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | uuid (PK) | 기본키 |
| `threads_user_id` | text (UNIQUE) | Threads 사용자 ID |
| `nickname` | text | 유저 식별용 닉네임 (예: "현준", "민수") |
| `access_token` | text | 장기 액세스 토큰 |
| `token_expires_at` | timestamp | 토큰 만료 예상 시간 |
| `is_active` | boolean | 자동 포스팅 활성화 여부 (기본 true) |
| `created_at` | timestamp | 최초 등록 시간 |
| `updated_at` | timestamp | 최종 갱신 시간 |

### `threads_posts` 테이블 (유저별 포스팅 이력)
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | uuid (PK) | 기본키 |
| `threads_user_id` | text (FK) | **어떤 유저의 포스트인지** |
| `category` | text | 콘텐츠 카테고리 |
| `content` | text | 포스트 본문 |
| `content_hash` | text | SHA-256 해시 (중복 방지) |
| `status` | text | 발행 상태 (success / fail / retry) |
| `post_id` | text | Threads 포스트 ID |
| `error_message` | text | 실패 시 에러 메시지 |
| `created_at` | timestamp | 생성 시간 |

> **중복 방지 제약**: `UNIQUE(threads_user_id, content_hash)` — 같은 유저 내에서만 중복 체크

### `content_categories` 테이블 (유저별 카테고리 설정)
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| `id` | serial (PK) | 기본키 |
| `threads_user_id` | text (FK) | **어떤 유저의 카테고리인지** |
| `name` | text | 카테고리명 |
| `persona` | text | 해당 카테고리의 페르소나 설명 |
| `keywords` | text[] | 관련 키워드 배열 |
| `is_active` | boolean | 활성화 여부 |

---

## 6. 에러 처리 & 모니터링

### 에러 유형별 처리
| 에러 | 처리 방식 |
| :--- | :--- |
| Claude API 실패 | 3회 재시도 (지수 백오프) → 실패 시 Discord 알림 |
| Threads API 429 (Rate Limit) | 해당 시간 스킵, 다음 스케줄에 실행 |
| Threads API 401 (토큰 만료) | 즉시 토큰 갱신 시도 → 실패 시 Discord 긴급 알림 |
| Supabase 연결 실패 | 3회 재시도 → 실패 시 로컬 로그 저장 + Discord 알림 |
| 콘텐츠 중복 감지 | 최대 3회 재생성 시도 |
| Claude API 비용 초과 | **[합의 #4]** 월 $10 초과 시 자동 중단 + Discord 긴급 알림 |

### Discord 알림 포맷
```
✅ [현준] 포스팅 성공: [기술/IT] 08:00 KST - "포스트 내용 미리보기..."
✅ [민수] 포스팅 성공: [생산성] 08:00 KST - "포스트 내용 미리보기..."
❌ [현준] 포스팅 실패: [에러 유형] - 상세 메시지
⚠️ [민수] 토큰 갱신 필요: 수동 확인 요망
```

---

## 7. 보안

- **환경 변수**: 모든 API Key, Secret은 GitHub Actions Secrets에 저장
- **토큰 암호화**: Supabase에 저장 시 RLS(Row Level Security) 적용
- **최소 권한 원칙**: Threads API는 `threads_basic`, `threads_content_publish` 권한만 요청
- **.env 로컬 개발용**: `.gitignore`에 반드시 포함

---

## 8. 프로젝트 구조

```
threads-automation/
├── .github/
│   └── workflows/
│       ├── post.yml          # 콘텐츠 생성 & 발행 (하루 3~4회)
│       └── refresh-token.yml # 토큰 갱신 (월 1회)
├── src/
│   ├── index.js              # 메인 실행 진입점
│   ├── claude.js             # Claude API 호출 & 프롬프트 관리
│   ├── threads.js            # Threads API 호출 (컨테이너 생성 + 발행)
│   ├── supabase.js           # Supabase DB 연동
│   ├── discord.js            # Discord Webhook 알림
│   └── utils.js              # 해시 생성, 유틸리티 함수
├── prompts/
│   └── personas.json         # 페르소나 & 카테고리 설정
├── scripts/
│   └── setup-token.js        # 최초 OAuth 토큰 획득 스크립트
├── .env.example
├── package.json
└── README.md
```

---

## 9. 실행 흐름 요약

```
[GitHub Actions Cron 트리거]
       │
       ▼
[1] Supabase에서 활성 유저 목록 조회 (is_active = true)
       │
       ▼
[2] ── 유저별 반복 (for each user) ──────────────────
       │
       ▼
  [2-1] 해당 유저의 토큰 & 최근 포스트 조회
       │
       ▼
  [2-2] 해당 유저의 카테고리 순환 선택
       │
       ▼
  [2-3] Claude API로 콘텐츠 생성
        - 유저별 페르소나 + 카테고리 + 최근 포스트 요약
       │
       ▼
  [2-4] 중복 체크 (해당 유저의 기존 포스트 기준)
        - 중복이면 → [2-3]으로 재생성 (최대 3회)
       │
       ▼
  [2-5] Threads API 2단계 발행 (해당 유저의 토큰 사용)
       │
       ▼
  [2-6] 결과 기록 (Supabase) + Discord 알림
       │
       ▼
── 다음 유저로 ─────────────────────────────────────
```

---

## 10. 검증 체크리스트

- [ ] Meta Developer 앱 생성 및 Threads API 권한 승인
- [ ] 앱에 테스터 계정 추가 (지인 Meta 계정)
- [ ] OAuth 플로우를 통한 최초 장기 토큰 획득 (본인 계정)
- [ ] 지인 계정 토큰 획득 테스트 (setup-token.js)
- [ ] 토큰 갱신 API 정상 동작 확인 (멀티유저 순회)
- [ ] Claude 프롬프트 결과물 품질 검토 (각 카테고리별 5개 샘플)
- [ ] Threads API 2단계 발행 프로세스 연동 테스트
- [ ] 멀티유저 순회 포스팅 테스트 (2개 계정 이상)
- [ ] 중복 방지 로직 검증 (유저별 독립 동작 확인)
- [ ] GitHub Actions Cron 스케줄 정상 작동 확인
- [ ] Discord 알림 연동 테스트 (유저 닉네임 표시)
- [ ] Rate Limit 상황 시뮬레이션 및 에러 처리 확인
- [ ] 24시간 무인 운영 테스트 (멀티유저)

---

## 11. 향후 확장 고려사항 (v2 이후)

- 이미지 첨부 포스팅 지원 (DALL-E 또는 Unsplash API 연동)
- 포스트 성과 분석 (좋아요, 답글 수 추적)
- 웹 대시보드 (Next.js) — 유저별 콘텐츠 미리보기 & 수동 발행
- 유저별 발행 스케줄 커스터마이징 (시간대, 빈도)
- 불특정 다수 대상 SaaS 전환 (OAuth 로그인 페이지, 결제 시스템)
