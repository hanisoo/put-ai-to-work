# AI 뉴스 수집기

논문을 준비 중인 사람들에게 해외 AI 뉴스(TechCrunch, The Verge)를 RSS로 수집하고, Claude가 한국어로 번역·요약·분류해 카드로 보여주는 앱입니다. 기능 명세는 [PRD.md](./PRD.md)를 참고하세요.

## 시작하기

```bash
npm install
cp .env.local.example .env.local   # 값 채우기
npm run db:migrate                 # 테이블 생성
npm run db:seed                    # 기본 카테고리 5개
npm run dev                        # http://localhost:3000
```

## 스크립트

| 명령                                 | 설명                                             |
| ------------------------------------ | ------------------------------------------------ |
| `npm run dev`                        | 개발 서버                                        |
| `npm run build` / `npm start`        | 프로덕션 빌드 / 실행                             |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript 검사                         |
| `npm run db:generate`                | `src/db/schema.ts` 변경 후 마이그레이션 SQL 생성 |
| `npm run db:migrate`                 | 마이그레이션 적용                                |
| `npm run db:seed`                    | 기본 카테고리 추가 (중복은 건너뜀)               |

## 참고

- Next.js 16에서는 `middleware.ts`가 `proxy.ts`로 이름이 바뀌어, Clerk 인증 보호는 `src/proxy.ts`에 있습니다.
- Notion 연결은 설정 화면에서 진행합니다. OAuth 콜백 주소는 `APP_URL` + `/api/notion/callback`입니다.
