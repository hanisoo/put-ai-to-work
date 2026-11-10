export type NewsSource = "techcrunch" | "theverge";

export const UNCATEGORIZED = "미분류";

/** RSS에서 정규화한 기사 (Claude 처리 전) */
export interface FeedItem {
  url: string;
  source: NewsSource;
  originalTitle: string;
  snippet: string;
  imageUrl: string | null;
  publishedAt: Date;
}

export interface FeedError {
  source: NewsSource;
  message: string;
}

/** 클라이언트에 내려주는 카테고리 */
export interface CategoryDTO {
  id: number;
  name: string;
  description: string;
}

/** 클라이언트에 내려주는 뉴스 카드 */
export interface ArticleDTO {
  id: number;
  url: string;
  source: NewsSource;
  originalTitle: string;
  titleKo: string;
  summaryKo: string;
  categoryId: number | null;
  categoryName: string | null;
  imageUrl: string | null;
  publishedAt: string;
  notionPageUrl: string | null;
}

export interface FetchNewsResult {
  added: number;
  skipped: number;
  failed: number;
  /** Claude 처리 실패 사유 (중복 제거) */
  failReasons: string[];
  feedErrors: FeedError[];
}

export interface NotionStatusDTO {
  connected: boolean;
  parentPageId: string | null;
  expiresAt: string | null;
}
