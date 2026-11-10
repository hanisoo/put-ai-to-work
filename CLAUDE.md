# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

해외 AI 뉴스(TechCrunch, The Verge RSS)를 수집해 Claude로 한국어 번역·요약·분류하고, Notion 원격 MCP로 저장하는 Next.js 앱. 기능 명세와 수용 기준은 `PRD.md`가 기준이다.

@AGENTS.md

## 제품 요구사항 (PRD 요약)

변경할 때 지켜야 하는 제약 위주로 정리했다. 세부 문구는 `PRD.md` 참고.

- **사용자 모델:** Clerk 로그인 사용자만 이용. 뉴스·카테고리·Notion 연결은 **모든 사용자가 공유**한다 (사용자별 분리 없음). `notion_saves.saved_by`에만 Clerk userId를 기록한다.
- **수집은 수동:** '뉴스 가져오기' 버튼으로만 수집한다. 기사 URL 기준 중복 제외, 새 기사마다 한국어 제목 + 3~4문장 요약 + 카테고리 1개(없으면 '미분류'). 완료 후 추가 건수를 보여준다.
- **카드:** 출처, 발행일, 한국어 제목·요약, 카테고리, 원문 링크, 썸네일(있으면), 'Notion 저장' 버튼. 최신 발행일 순. 그리드는 모바일 1열 / 태블릿 2열 / 데스크톱 3열 (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
- **카테고리 탭:** 전체 / 각 카테고리 / 미분류. 카테고리 추가·수정·삭제는 탭에 바로 반영되어야 한다. 카테고리 설명은 Claude 분류 힌트로 프롬프트에 들어간다.
- **재분류:** 카테고리를 바꿔도 기존 기사는 자동으로 바뀌지 않는다. '재분류' 버튼을 눌렀을 때만, 저장된 한국어 제목·요약으로 **분류만** 다시 한다 (번역·요약은 재생성하지 않음).
- **Notion 저장:** 성공하면 카드에 '저장됨' + Notion 페이지 링크. 토큰 만료 시 refresh token으로 갱신, 실패하면 재연결 안내. 페이지 내용은 제목·요약·카테고리·출처·원문 링크.
- **비기능 요구사항:**
  - 비용: 중복 기사는 Claude로 보내지 않고, 새 기사는 배치로 묶어 호출한다.
  - 안정성: 피드 하나가 실패해도 나머지를 처리하고 실패 내역을 사용자에게 보여준다.
  - 구조화 출력: Claude 응답은 JSON 스키마(structured output)로 받는다. 자유 텍스트 파싱으로 바꾸지 말 것 (Notion 페이지 URL 추출만 예외).
  - 보안: API 키·Notion 토큰은 서버에서만 다룬다. 토큰을 클라이언트 응답에 넣지 말 것 (`/api/notion/settings`는 연결 여부·상위 페이지 ID·만료 시각만 반환).

**범위 외 (이번 버전에서 구현하지 않음):** 자동/정기 수집(스케줄러), 사용자별 뉴스·카테고리 분리, 기사 본문 크롤링(RSS 내용만 사용 — 썸네일용 og:image 수집도 하지 않음), 두 피드 외 뉴스 소스 추가 UI.

### 화면과 API

| 화면 | 구성 |
|---|---|
| `/` | '뉴스 가져오기' 버튼, 카테고리 탭, 카드 그리드 |
| `/categories` | 카테고리 목록, 추가/수정/삭제, '재분류' 버튼 |
| `/settings` | Notion 연결 상태·연결 버튼, 상위 페이지 지정 |
| `/sign-in`, `/sign-up` | Clerk 컴포넌트 |

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/news?category={id\|uncategorized}` | 뉴스 목록 (생략 또는 `all`이면 전체) |
| POST | `/api/news/fetch` | 수집 → Claude 처리 → 저장. `{added, skipped, failed, failReasons, feedErrors}` |
| POST | `/api/news/reclassify` | 전체 재분류. `{total, changed, failed, failReasons}` |
| GET / POST | `/api/categories` | 목록 / 추가 |
| PATCH / DELETE | `/api/categories/[id]` | 수정 / 삭제 |
| GET | `/api/notion/connect` | OAuth 시작 (DCR + PKCE) → Notion으로 리디렉트 |
| GET | `/api/notion/callback` | 토큰 교환 후 `/settings`로 리디렉트 |
| GET / PATCH | `/api/notion/settings` | 연결 상태 / 상위 페이지 지정 (URL 또는 ID) |
| POST | `/api/notion/save` | 기사 Notion 저장 → `{notionPageUrl}` |

### 데이터 모델 (`src/db/schema.ts`)

| 테이블 | 핵심 |
|---|---|
| `categories` | `name` unique, `description`은 분류 힌트 |
| `articles` | `url` unique(중복 판단 기준), `source`는 `techcrunch`\|`theverge`, `category_id` nullable FK `ON DELETE SET NULL` |
| `notion_saves` | 기사당 여러 건 가능, 목록에서는 가장 최근 것의 URL을 쓴다 |
| `notion_connection` | id=1 한 행만 유지 |

### 환경 변수 (`.env.local`, 템플릿은 `.env.local.example`)

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`(`/sign-in`), `NEXT_PUBLIC_CLERK_SIGN_UP_URL`(`/sign-up`), `DATABASE_URL`(Neon), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`(기본 `claude-opus-5-5`, 비용을 줄이려면 Sonnet/Haiku), `APP_URL`(OAuth 콜백 기준, 예: `http://localhost:3000`). 서버 코드에서 읽는 환경 변수는 dev 서버를 재시작해야 반영된다.

### PRD와 다른 구현

- PRD의 `src/middleware.ts` → Next.js 16 규칙에 따라 `src/proxy.ts`.
- PRD 디렉토리 구조에 없는 파일: `lib/api.ts`(인증·오류 응답 헬퍼), `lib/category-input.ts`(카테고리 입력 검증), `lib/source-labels.ts`(출처 표시 이름). PRD의 `postcss.config.mjs`는 없다 (Tailwind v4를 `@tailwindcss/turbopack` 로더로 연결).

### 수용 기준 (변경 후 확인할 것)

1. 로그인하지 않으면 모든 화면이 로그인 페이지로 이동한다.
2. '뉴스 가져오기' 후 한국어 제목·요약·카테고리가 붙은 카드가 표시되고, 다시 눌러도 이미 가져온 기사는 중복되지 않는다.
3. 카테고리 탭을 고르면 해당 뉴스만 보인다.
4. 카테고리 추가·수정·삭제가 탭에 바로 반영되고, 삭제된 카테고리의 뉴스는 '미분류'로 옮겨진다.
5. '재분류'를 누르면 현재 카테고리 기준으로 기사가 다시 분류된다.
6. Notion 연결 후 'Notion 저장'을 누르면 지정한 상위 페이지 아래에 기사 페이지가 생기고, 카드에 '저장됨'이 표시된다.

## 명령어

```bash
npm run dev            # 개발 서버 (http://localhost:3000)
npm run build          # 프로덕션 빌드 — Cache Components 프리렌더 오류는 여기서만 드러난다
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit (RouteContext 등 라우트 타입이 없으면 먼저 `npx next typegen`)
npm run db:generate    # src/db/schema.ts 변경 후 drizzle/ 에 마이그레이션 SQL 생성
npm run db:migrate     # 마이그레이션 적용 (Neon)
npm run db:seed        # 기본 카테고리 5개 (이름 중복은 건너뜀)
```

테스트 프레임워크는 없다. 서버 라이브러리(`src/lib/*`)를 단독 실행해 확인할 때는 `.mts` 스크립트(top-level await 사용)에서 dotenv로 `.env.local`을 먼저 로드한 뒤 동적 import하고, `server-only` 때문에 react-server 조건으로 실행한다:

```bash
npx tsx --conditions=react-server path/to/script.mts
```

## Next.js 16 주의점 (AGENTS.md 참고)

- 인증 미들웨어 파일은 `middleware.ts`가 아니라 **`src/proxy.ts`** (Clerk `clerkMiddleware`). `/sign-in`, `/sign-up` 외 모든 화면·API를 보호한다.
- `next.config.ts`에 **`cacheComponents: true`**. 동적 라우트에서 `usePathname()`/`useSearchParams()`를 쓰는 클라이언트 컴포넌트는 `<Suspense>` 안에 있어야 빌드가 통과한다 (`layout.tsx`의 Header, sign-in/up 페이지, settings 페이지가 그래서 Suspense로 감싸져 있음).
- 라우트 핸들러의 동적 params는 `RouteContext<"/api/...">` 타입 + `await ctx.params`. 라우트 파일에서는 HTTP 메서드·세그먼트 설정 외의 export를 하면 안 된다.

## 아키텍처

**렌더링 방식:** 페이지(`src/app/**/page.tsx`)는 얇은 서버 컴포넌트이고, 실제 UI는 `src/components/*`의 클라이언트 컴포넌트가 `/api/*`를 fetch해서 그린다. 서버 데이터를 페이지에서 직접 읽지 않으므로 페이지들은 정적 셸로 프리렌더된다. 모든 API 라우트는 `src/lib/api.ts`의 `requireUser()`로 Clerk 인증을 다시 확인한다.

**뉴스 수집 흐름 (`POST /api/news/fetch`):** `lib/rss.ts`가 두 피드를 `Promise.allSettled`로 수집(한 피드 실패해도 계속, URL에서 utm·hash 제거 후 중복 제거) → DB에 이미 있는 URL은 제외 → 새 기사만 `lib/claude.ts`의 `processArticles`로 처리 → 성공한 것만 insert. 처리 실패한 기사는 저장하지 않으므로 다음 수집 때 자동 재시도된다. TechCrunch 피드에는 이미지가 없어 썸네일은 The Verge만 나온다.

**Claude 호출 (`lib/claude.ts`):**
- `client.beta.messages.parse` + `betaZodOutputFormat`(zod)로 structured output을 받는다. 카테고리 필드는 **현재 DB 카테고리 이름 + '미분류'로 만든 동적 `z.enum`**이라 응답이 항상 유효한 이름이다.
- 모든 호출에 `fallbacks: "default"` + `server-side-fallback-2026-07-01` beta (거절 시 서버 측 모델 폴백).
- `runBatches`가 배치(번역 8건, 재분류 25건)를 동시 3개로 실행하고, 실패 사유를 모아 반환한다. 4xx(408·429 제외) 같은 치명적 오류가 나면 남은 배치를 호출하지 않는다. API 라우트는 이 사유를 `failReasons`로 클라이언트에 내려 UI에 표시한다.
- 모델은 `ANTHROPIC_MODEL` 환경 변수(기본 `claude-opus-5-5`).

**카테고리와 '미분류':** '미분류'는 별도 행이 아니라 `articles.category_id = NULL`이다. FK가 `ON DELETE SET NULL`이라 카테고리를 삭제하면 DB가 알아서 해당 기사를 미분류로 만든다. '미분류'·'전체'는 예약어(`lib/category-input.ts`). 재분류(`/api/news/reclassify`)는 저장된 한국어 제목·요약만 보내고 바뀐 기사만 update한다.

**Notion 연동 (`lib/notion-oauth.ts`, `lib/notion-mcp.ts`):**
- `notion_connection` 테이블은 **id=1 한 행만** 쓰며 모든 사용자가 공유한다 (토큰, DCR client_id, 상위 페이지 ID).
- OAuth: `mcp.notion.com`의 well-known 메타데이터 디스커버리 → 동적 클라이언트 등록(DCR, 최초 1회) → PKCE. verifier/state는 `/api/notion/callback` 경로 한정 httpOnly 쿠키에 보관. `APP_URL`이 콜백 기준 주소.
- 저장: `client.beta.messages.create`에 `mcp_servers`(authorization_token) + `tools: [{type:"mcp_toolset"}]` + `mcp-client-2025-11-20` beta. `pause_turn`이면 응답을 이어 붙여 재요청한다. 만료 60초 전이면 refresh token으로 갱신하고, 갱신 실패 시 토큰을 지우고 `NotionReconnectError`(→ 409 `reconnect: true`)로 재연결을 안내한다.
- 생성된 페이지 URL은 Claude 응답 텍스트/MCP 도구 결과에서 정규식으로 추출한다. Notion은 현재 **`https://app.notion.com/p/<32hex>`** 형식을 주며, 상위 페이지 URL은 제외해야 한다.

**클라이언트 번들 주의:** `lib/source-labels.ts`가 따로 있는 이유는 클라이언트 컴포넌트가 `lib/rss.ts`(rss-parser)를 import하지 않게 하기 위해서다. `claude.ts`, `notion-*.ts`, `api.ts`는 `server-only`.
