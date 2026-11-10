import type { NewsSource } from "./types";

/** 클라이언트·서버 공용 출처 표시 이름 (rss-parser를 클라이언트 번들에 넣지 않기 위해 분리) */
export const SOURCE_LABELS: Record<NewsSource, string> = {
  techcrunch: "TechCrunch",
  theverge: "The Verge",
};
