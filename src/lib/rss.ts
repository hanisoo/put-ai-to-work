import Parser from "rss-parser";
import type { FeedError, FeedItem, NewsSource } from "./types";

export const FEEDS: { source: NewsSource; label: string; url: string }[] = [
  {
    source: "techcrunch",
    label: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    source: "theverge",
    label: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
];

type MediaNode = { $?: { url?: string; medium?: string; type?: string } };
type CustomItem = {
  mediaContent?: MediaNode | MediaNode[];
  mediaThumbnail?: MediaNode | MediaNode[];
  contentEncoded?: string;
};

const parser: Parser<object, CustomItem> = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "AI-News-Collector/1.0 (RSS reader)" },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

const SNIPPET_MAX = 1500;

function firstMediaUrl(node: MediaNode | MediaNode[] | undefined): string | null {
  const list = Array.isArray(node) ? node : node ? [node] : [];
  for (const m of list) {
    const url = m?.$?.url;
    if (!url) continue;
    const isImage =
      !m.$?.medium && !m.$?.type
        ? true
        : m.$?.medium === "image" || (m.$?.type ?? "").startsWith("image/");
    if (isImage) return url;
  }
  return null;
}

function firstImgInHtml(html: string | undefined): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_")) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return raw.trim();
  }
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<FeedItem[]> {
  const parsed = await parser.parseURL(feed.url);
  const items: FeedItem[] = [];

  for (const item of parsed.items) {
    const link = item.link ?? item.guid;
    const title = item.title?.trim();
    if (!link || !title) continue;

    const html = item.contentEncoded ?? item.content ?? "";
    const text = item.contentSnippet?.trim() || stripHtml(html) || item.summary || "";
    const date = item.isoDate ?? item.pubDate;
    const publishedAt = date ? new Date(date) : new Date();

    items.push({
      url: normalizeUrl(link),
      source: feed.source,
      originalTitle: title,
      snippet: text.slice(0, SNIPPET_MAX),
      imageUrl:
        item.enclosure?.url && (item.enclosure.type ?? "image/").startsWith("image/")
          ? item.enclosure.url
          : firstMediaUrl(item.mediaContent) ??
            firstMediaUrl(item.mediaThumbnail) ??
            firstImgInHtml(html),
      publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
    });
  }
  return items;
}

/** 모든 피드를 수집한다. 피드 하나가 실패해도 나머지는 계속 처리한다. */
export async function fetchAllFeeds(): Promise<{ items: FeedItem[]; errors: FeedError[] }> {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const items: FeedItem[] = [];
  const errors: FeedError[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      const reason = result.reason;
      errors.push({
        source: FEEDS[i].source,
        message: reason instanceof Error ? reason.message : String(reason),
      });
    }
  });

  // 같은 수집 안에서도 URL 중복 제거
  const unique = new Map<string, FeedItem>();
  for (const item of items) if (!unique.has(item.url)) unique.set(item.url, item);

  return { items: [...unique.values()], errors };
}
