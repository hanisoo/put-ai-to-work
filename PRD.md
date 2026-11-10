/ㅊ# AI 뉴스 수집기 (AI News Collector) — PRD

## 1. 개요
해외 AI 뉴스를 RSS로 필요할 때 수집하고, Claude AI가 한국어로 번역·요약·카테고리 분류하여 카드 형태로 보여주는 웹 애플리케이션. 마음에 드는 뉴스는 버튼 한 번으로 Notion에 저장할 수 있다.

## 2. 목표
- 해외 AI 뉴스를 한국어 요약으로 빠르게 훑어볼 수 있게 한다.
- 뉴스를 카테고리별로 자동 분류하고, 원하는 카테고리만 골라 볼 수 있게 한다.
- 중요한 뉴스를 Notion에 손쉽게 아카이빙한다.

## 3. 사용자
- 로그인한 사용자만 이용 가능 (Clerk).
- 뉴스와 카테고리는 **모든 사용자가 공유**한다 (사용자별 분리 없음).

## 4. 뉴스 소스
| 소스 | RSS URL |
|---|---|
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ |
| The Verge AI | https://www.theverge.com/rss/ai-artificial-intelligence/index.xml |

## 5. 기능 요구사항

### F1. 로그인
- 앱 실행 시 로그인하지 않은 사용자는 로그인 페이지로 이동한다.
- Clerk의 로그인/회원가입 페이지를 사용하고, 헤더에 사용자 메뉴(UserButton)를 표시한다.

### F2. 뉴스 가져오기
- 메인 화면의 **'뉴스 가져오기'** 버튼을 누르면 두 RSS 피드를 수집한다.
- **기사 URL 기준으로 중복을 제외**하고 새 기사만 처리한다.
- 새 기사는 Claude API로 다음을 생성한다:
  - 한국어 제목
  - 한국어 요약 (3~4문장)
  - 카테고리 (현재 등록된 카테고리 중 하나, 해당 없으면 '미분류')
- 처리 중에는 로딩 상태를, 완료 후에는 추가된 기사 수를 표시한다.

### F3. 뉴스 카드 목록
- 카드 항목: 출처, 발행일, 한국어 제목, 한국어 요약, 카테고리, 원문 링크, (있으면) 썸네일, 'Notion 저장' 버튼.
- 최신 발행일 순으로 정렬한다.

### F4. 카테고리 필터
- 상단 탭: **전체 / 각 카테고리 / 미분류**.
- 탭을 선택하면 해당 카테고리 뉴스만 표시한다.

### F5. 카테고리 관리
- 카테고리 **추가 / 이름·설명 수정 / 삭제**가 가능하다.
- 카테고리 설명은 Claude 분류 시 힌트로 사용한다.
- 카테고리를 삭제하면 그 카테고리의 뉴스는 **'미분류'**로 바뀐다.
- 카테고리가 바뀌어도 기존 뉴스는 그대로 두고, **'재분류' 버튼**을 누르면 Claude가 저장된 한국어 제목·요약을 바탕으로 전체 기사를 다시 분류한다 (번역·요약은 다시 하지 않음).
- 초기 기본 카테고리: 모델/연구, 제품/서비스, 투자/비즈니스, 정책/규제, 기타.

### F6. Notion 저장
- 설정 화면에서 **'Notion 연결'**로 Notion 원격 MCP 서버(`https://mcp.notion.com/mcp`)에 OAuth로 연결한다. 한 번 연결한 토큰은 모든 사용자가 함께 쓴다.
- 설정 화면에서 기사를 저장할 **Notion 상위 페이지**를 지정한다.
- 카드의 'Notion 저장'을 누르면 서버가 Claude API를 호출하면서 `mcp_servers`에 Notion MCP를 연결하고, 지정한 상위 페이지 아래에 기사 페이지(제목, 요약, 카테고리, 출처, 원문 링크)를 만든다.
- 저장에 성공하면 카드에 '저장됨' 표시와 Notion 페이지 링크를 보여준다.
- 토큰이 만료되면 refresh token으로 갱신하고, 갱신에 실패하면 다시 연결하라고 안내한다.

## 6. 비기능 요구사항
- **비용 효율:** 중복 기사는 Claude로 처리하지 않는다. 새 기사는 배치로 묶어 호출한다.
- **안정성:** 피드 하나가 실패해도 나머지 피드는 처리하고, 실패 내역을 사용자에게 알린다.
- **구조화 출력:** Claude 응답은 JSON 스키마(structured output)로 받아 파싱 오류를 막는다.
- **보안:** API 키와 Notion 토큰은 서버에서만 다루고 클라이언트에 노출하지 않는다. 모든 API 라우트는 Clerk 인증을 확인한다.
- **반응형 UI:** 모바일 1열, 태블릿 2열, 데스크톱 3열 카드 그리드.

## 7. 기술 스택
| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js (App Router, TypeScript), Tailwind CSS |
| 인증 | Clerk (`@clerk/nextjs`) |
| DB | Neon (PostgreSQL, `@neondatabase/serverless`) |
| ORM | Drizzle ORM, drizzle-kit |
| AI | Claude API (`@anthropic-ai/sdk`) — 번역·요약·분류·Notion 저장 |
| RSS | `rss-parser` |
| Notion | Notion 원격 MCP 서버 (Claude API MCP 커넥터 사용) |

## 8. 데이터 모델
| 테이블 | 컬럼 |
|---|---|
| `categories` | id, name (unique), description, createdAt, updatedAt |
| `articles` | id, url (unique), source (`techcrunch` \| `theverge`), originalTitle, titleKo, summaryKo, categoryId (nullable, FK on delete set null), imageUrl, publishedAt, createdAt |
| `notion_saves` | id, articleId (FK), notionPageUrl, savedBy (Clerk userId), createdAt |
| `notion_connection` | id, accessToken, refreshToken, expiresAt, clientId, clientSecret, parentPageId, updatedAt (1건만 유지) |

## 9. API 명세
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/news?category={id\|uncategorized}` | 뉴스 목록 (필터) |
| POST | `/api/news/fetch` | RSS 수집 → Claude 처리 → 저장, 추가 건수 반환 |
| POST | `/api/news/reclassify` | 전체 기사 재분류 |
| GET / POST | `/api/categories` | 카테고리 목록 / 추가 |
| PATCH / DELETE | `/api/categories/[id]` | 카테고리 수정 / 삭제 |
| GET | `/api/notion/connect` | Notion OAuth 시작 (DCR + PKCE) |
| GET | `/api/notion/callback` | 토큰 교환 후 저장 |
| GET / PATCH | `/api/notion/settings` | 연결 상태 조회 / 상위 페이지 지정 |
| POST | `/api/notion/save` | 기사 Notion 저장 |

## 10. 화면 구성
- **메인 (`/`)**: 헤더, '뉴스 가져오기' 버튼, 카테고리 탭, 뉴스 카드 그리드
- **카테고리 관리 (`/categories`)**: 카테고리 목록, 추가/수정/삭제 폼, '재분류' 버튼
- **설정 (`/settings`)**: Notion 연결 상태, 연결 버튼, 상위 페이지 지정
- **로그인/회원가입 (`/sign-in`, `/sign-up`)**: Clerk 컴포넌트

## 11. 디렉토리 구조
```
AI-NEWS-COLLECTOR/
├── PRD.md
├── .env.local.example                 # 환경 변수 템플릿
├── .gitignore
├── drizzle.config.ts                  # drizzle-kit 설정 (Neon DATABASE_URL)
├── next.config.ts
├── package.json
├── tsconfig.json
├── postcss.config.mjs                 # Tailwind
├── drizzle/                           # drizzle-kit 생성 마이그레이션 SQL
└── src/
    ├── middleware.ts                  # Clerk 인증: sign-in/up 외 전체 보호
    ├── app/
    │   ├── layout.tsx                 # ClerkProvider, 공통 헤더
    │   ├── globals.css
    │   ├── page.tsx                   # 메인: 탭 + 카드 그리드 + 가져오기 버튼
    │   ├── sign-in/[[...sign-in]]/page.tsx
    │   ├── sign-up/[[...sign-up]]/page.tsx
    │   ├── categories/
    │   │   └── page.tsx               # 카테고리 관리 + 재분류
    │   ├── settings/
    │   │   └── page.tsx               # Notion 연결 설정
    │   └── api/
    │       ├── news/
    │       │   ├── route.ts           # GET 목록
    │       │   ├── fetch/route.ts     # POST 수집·처리
    │       │   └── reclassify/route.ts# POST 재분류
    │       ├── categories/
    │       │   ├── route.ts           # GET / POST
    │       │   └── [id]/route.ts      # PATCH / DELETE
    │       └── notion/
    │           ├── connect/route.ts   # OAuth 시작
    │           ├── callback/route.ts  # OAuth 콜백
    │           ├── settings/route.ts  # 상태 / 상위 페이지
    │           └── save/route.ts      # Notion 저장
    ├── components/
    │   ├── Header.tsx                 # 내비(뉴스/카테고리/설정) + UserButton
    │   ├── NewsFeed.tsx               # 필터 상태, 목록 로딩
    │   ├── CategoryTabs.tsx
    │   ├── NewsCard.tsx               # 카드 + Notion 저장 버튼
    │   ├── FetchNewsButton.tsx
    │   ├── CategoryManager.tsx
    │   ├── ReclassifyButton.tsx
    │   └── NotionConnectPanel.tsx
    ├── db/
    │   ├── index.ts                   # Neon 클라이언트 + drizzle 인스턴스
    │   ├── schema.ts                  # 테이블 정의
    │   └── seed.ts                    # 기본 카테고리 시드
    └── lib/
        ├── rss.ts                     # 피드 정의 + 파싱/정규화
        ├── claude.ts                  # 번역·요약·분류, 재분류
        ├── notion-mcp.ts              # Claude API + Notion MCP 페이지 생성
        ├── notion-oauth.ts            # 디스커버리, DCR, PKCE, 토큰 갱신
        └── types.ts                   # 공용 타입
```

## 12. 환경 변수
| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-in`, `/sign-up` |
| `DATABASE_URL` | Neon 연결 문자열 |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `ANTHROPIC_MODEL` | 기본 `claude-opus-5-5` (비용을 줄이려면 Sonnet/Haiku) |
| `APP_URL` | OAuth 콜백 기준 URL (예: `http://localhost:3000`) |

## 13. 범위 외 (이번 버전 제외)
- 자동/정기 수집 (스케줄러)
- 사용자별 뉴스·카테고리 분리
- 기사 본문 전체 크롤링 (RSS에 담긴 내용만 사용)
- 위 두 곳 외의 뉴스 소스 추가 UI

## 14. 수용 기준
1. 로그인하지 않으면 모든 화면이 로그인 페이지로 이동한다.
2. '뉴스 가져오기' 후 한국어 제목·요약·카테고리가 붙은 카드가 표시되고, 다시 눌러도 이미 가져온 기사는 중복되지 않는다.
3. 카테고리 탭을 고르면 해당 뉴스만 보인다.
4. 카테고리 추가·수정·삭제가 탭에 바로 반영되고, 삭제된 카테고리의 뉴스는 '미분류'로 옮겨진다.
5. '재분류'를 누르면 현재 카테고리 기준으로 기사가 다시 분류된다.
6. Notion을 연결한 뒤 'Notion 저장'을 누르면 지정한 상위 페이지 아래에 기사 페이지가 생기고, 카드에 '저장됨'이 표시된다.
