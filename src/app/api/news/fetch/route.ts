import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories, type NewArticle } from "@/db/schema";
import { errorMessage, jsonError, requireUser } from "@/lib/api";
import { processArticles } from "@/lib/claude";
import { fetchAllFeeds } from "@/lib/rss";
import type { FetchNewsResult } from "@/lib/types";

export const maxDuration = 300;

export async function POST() {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const { items, errors: feedErrors } = await fetchAllFeeds();

    // URL 기준으로 이미 저장된 기사는 Claude로 처리하지 않는다.
    const existing = items.length
      ? await db
          .select({ url: articles.url })
          .from(articles)
          .where(inArray(articles.url, items.map((i) => i.url)))
      : [];
    const existingUrls = new Set(existing.map((e) => e.url));
    const fresh = items.filter((i) => !existingUrls.has(i.url));

    let added = 0;
    let failed = 0;
    let failReasons: string[] = [];

    if (fresh.length > 0) {
      const cats = await db
        .select({ id: categories.id, name: categories.name, description: categories.description })
        .from(categories);
      const idByName = new Map(cats.map((c) => [c.name, c.id]));

      const { results: processed, errors } = await processArticles(fresh, cats);
      failReasons = errors;
      const rows: NewArticle[] = [];
      processed.forEach((p, i) => {
        if (!p) {
          failed++;
          return;
        }
        const item = fresh[i];
        rows.push({
          url: item.url,
          source: item.source,
          originalTitle: item.originalTitle,
          titleKo: p.titleKo,
          summaryKo: p.summaryKo,
          categoryId: idByName.get(p.categoryName) ?? null,
          imageUrl: item.imageUrl,
          publishedAt: item.publishedAt,
        });
      });

      if (rows.length) {
        const inserted = await db
          .insert(articles)
          .values(rows)
          .onConflictDoNothing({ target: articles.url })
          .returning({ id: articles.id });
        added = inserted.length;
      }
    }

    const result: FetchNewsResult = {
      added,
      skipped: items.length - fresh.length,
      failed,
      failReasons,
      feedErrors,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("[news/fetch]", err);
    return jsonError(`뉴스를 가져오지 못했습니다: ${errorMessage(err)}`, 500);
  }
}
